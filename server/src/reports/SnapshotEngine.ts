import { createHash } from 'node:crypto';
import { google } from 'googleapis';
import { createGoogleAuth } from '../ingestion/googleAuth.js';
import { DataSourceService } from '../services/DataSourceService.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotFileRegistryRepository } from '../repositories/SnapshotFileRegistryRepository.js';
import { parseSnapshotFilename } from './filename-parser.js';
import { SnapshotMetricsService } from '../snapshots/SnapshotMetricsService.js';
import { mapWithConcurrency } from '../utils/concurrency.js';
import { processReport } from './registry.js';
import type { ParsedFilename } from './types.js';
import type { ReportType } from './types.js';

export interface SnapshotSyncResult {
  scanned: number;
  processed: number;
  skipped: number;
  errors: Array<{ fileName: string; error: string }>;
  processedSnapshotDates: string[];
  processedSnapshotKeys: string[];
  files: Array<{ name: string; status: 'success' | 'failed'; error?: string }>;
}

interface DriveListedFile {
  id: string;
  name: string;
  md5Checksum: string | null;
  meta: ParsedFilename;
}

const PROCESS_CONCURRENCY = 8;

export interface SnapshotSyncOptions {
  /** When true, re-download snapshot CSVs from Drive and recompute metrics even if registry checksums are unchanged. */
  forceRefresh?: boolean;
}

export class SnapshotEngine {
  private drive = google.drive({ version: 'v3', auth: createGoogleAuth() });

  async syncFromDrive(options: SnapshotSyncOptions = {}): Promise<SnapshotSyncResult> {
    const forceRefresh = options.forceRefresh === true;
    const sources = await DataSourceService.activeSources();
    const revenueSource = sources.find((source) => source.code === 'REVENUE_CSV');
    if (!revenueSource) throw new Error('Revenue data source folder is not configured');

    const [listResponse, registry] = await Promise.all([
      this.drive.files.list({
        q: `'${revenueSource.locationRef}' in parents and trashed = false and mimeType = 'text/csv'`,
        fields: 'files(id,name,mimeType,modifiedTime,size,md5Checksum)',
        pageSize: 500,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      }),
      SnapshotFileRegistryRepository.listAll(),
    ]);
    const result: SnapshotSyncResult = {
      scanned: 0,
      processed: 0,
      skipped: 0,
      errors: [],
      processedSnapshotDates: [],
      processedSnapshotKeys: [],
      files: [],
    };
    const fileIndex = new Map<string, { name: string; status: 'success' | 'failed'; error?: string }>();
    const affectedSnapshotKeys = new Set<string>();
    const candidates: DriveListedFile[] = [];

    for (const file of listResponse.data.files ?? []) {
      if (!file.id || !file.name) continue;
      const meta = parseSnapshotFilename(file.name);
      if (!meta) continue;

      result.scanned += 1;
      const registryEntry = registry.get(file.id);
      if (!forceRefresh && SnapshotFileRegistryRepository.isRegistryEntryUnchanged(registryEntry, file.md5Checksum ?? null)) {
        result.skipped += 1;
        continue;
      }

      candidates.push({
        id: file.id,
        name: file.name,
        md5Checksum: file.md5Checksum ?? null,
        meta,
      });
    }

    const processOutcomes = await mapWithConcurrency(candidates, PROCESS_CONCURRENCY, async (driveFile) => {
      try {
        const contentResponse = await this.drive.files.get({ fileId: driveFile.id, alt: 'media' }, { responseType: 'text' });
        const content = String(contentResponse.data);
        if (!content.trim()) {
          return { kind: 'skipped' as const };
        }

        const checksum = createHash('sha256').update(content).digest('hex');
        const registryEntry = registry.get(driveFile.id);
        if (!forceRefresh && SnapshotFileRegistryRepository.isRegistryEntryUnchanged(registryEntry, driveFile.md5Checksum, checksum)) {
          return { kind: 'skipped' as const, snapshotKey: driveFile.meta.snapshotKey };
        }

        const existing = await ReportSnapshotRepository.findByChecksum(driveFile.meta.reportType, checksum);
        if (existing) {
          await SnapshotFileRegistryRepository.upsert({
            providerFileId: driveFile.id,
            fileName: driveFile.meta.fileName,
            reportType: driveFile.meta.reportType,
            snapshotKey: driveFile.meta.snapshotKey,
            snapshotDate: driveFile.meta.snapshotDate,
            driveMd5Checksum: driveFile.md5Checksum,
            contentChecksum: checksum,
          });
          return forceRefresh
            ? { kind: 'refreshed' as const, snapshotKey: driveFile.meta.snapshotKey, reportType: driveFile.meta.reportType }
            : { kind: 'skipped' as const, snapshotKey: driveFile.meta.snapshotKey, reportType: driveFile.meta.reportType };
        }

        const payload = processReport(content, driveFile.meta);
        await ReportSnapshotRepository.upsert({
          reportType: driveFile.meta.reportType,
          snapshotKey: driveFile.meta.snapshotKey,
          snapshotDate: driveFile.meta.snapshotDate,
          snapshotTimestamp: new Date(driveFile.meta.snapshotTimestamp),
          providerFileId: driveFile.id,
          fileName: driveFile.meta.fileName,
          checksum,
          payloadJson: payload,
        });
        await SnapshotFileRegistryRepository.upsert({
          providerFileId: driveFile.id,
          fileName: driveFile.meta.fileName,
          reportType: driveFile.meta.reportType,
          snapshotKey: driveFile.meta.snapshotKey,
          snapshotDate: driveFile.meta.snapshotDate,
          driveMd5Checksum: driveFile.md5Checksum,
          contentChecksum: checksum,
        });
        return {
          kind: 'processed' as const,
          snapshotKey: driveFile.meta.snapshotKey,
          snapshotDate: driveFile.meta.snapshotDate,
          reportType: driveFile.meta.reportType,
        };
      } catch (error) {
        return {
          kind: 'error' as const,
          fileName: driveFile.name,
          reportType: driveFile.meta.reportType,
          error: error instanceof Error ? error.message : 'Unknown processing error',
        };
      }
    });

    for (const outcome of processOutcomes) {
      if (outcome.kind === 'skipped') {
        result.skipped += 1;
        if (forceRefresh && 'snapshotKey' in outcome && outcome.snapshotKey) {
          affectedSnapshotKeys.add(outcome.snapshotKey);
        }
        continue;
      }
      if (outcome.kind === 'error') {
        result.errors.push({ fileName: outcome.reportType, error: outcome.error });
        fileIndex.set(outcome.reportType, {
          name: outcome.reportType,
          status: 'failed',
          error: outcome.error,
        });
        continue;
      }
      if (outcome.kind === 'refreshed') {
        result.skipped += 1;
        affectedSnapshotKeys.add(outcome.snapshotKey);
        fileIndex.set(outcome.reportType, { name: outcome.reportType, status: 'success' });
        continue;
      }
      result.processed += 1;
      affectedSnapshotKeys.add(outcome.snapshotKey);
      fileIndex.set(outcome.reportType, { name: outcome.reportType, status: 'success' });
      if (!result.processedSnapshotDates.includes(outcome.snapshotDate)) {
        result.processedSnapshotDates.push(outcome.snapshotDate);
      }
      if (!result.processedSnapshotKeys.includes(outcome.snapshotKey)) {
        result.processedSnapshotKeys.push(outcome.snapshotKey);
      }
    }

    if (affectedSnapshotKeys.size > 0) {
      const metricErrors: Array<{ fileName: string; error: string }> = [];
      await Promise.all([...affectedSnapshotKeys].map(async (snapshotKey) => {
        try {
          await SnapshotMetricsService.recomputeForSnapshotKey(snapshotKey);
        } catch (error) {
          metricErrors.push({
            fileName: `snapshot_metrics:${snapshotKey}`,
            error: error instanceof Error ? error.message : 'Metrics precompute failed',
          });
        }
      }));
      if (metricErrors.length > 0) {
        console.warn('[snapshot-engine] Snapshot metrics precompute failed', metricErrors);
        result.errors.push(...metricErrors);
      }
    }

    result.files = [...fileIndex.values()].sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  async getPayload<T>(snapshotKey: string, reportType: ReportType): Promise<T | null> {
    const batch = await ReportSnapshotRepository.getBatch(snapshotKey);
    const match = batch.find((row) => row.reportType === reportType);
    return (match?.payloadJson as T | undefined) ?? null;
  }
}
