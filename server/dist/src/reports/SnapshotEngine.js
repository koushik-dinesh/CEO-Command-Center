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
const PROCESS_CONCURRENCY = 8;
export class SnapshotEngine {
    drive = google.drive({ version: 'v3', auth: createGoogleAuth() });
    async syncFromDrive(options = {}) {
        const forceRefresh = options.forceRefresh === true;
        const sources = await DataSourceService.activeSources();
        const revenueSource = sources.find((source) => source.code === 'REVENUE_CSV');
        if (!revenueSource)
            throw new Error('Revenue data source folder is not configured');
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
        const result = {
            scanned: 0,
            processed: 0,
            skipped: 0,
            errors: [],
            processedSnapshotDates: [],
            processedSnapshotKeys: [],
        };
        const affectedSnapshotKeys = new Set();
        const candidates = [];
        for (const file of listResponse.data.files ?? []) {
            if (!file.id || !file.name)
                continue;
            const meta = parseSnapshotFilename(file.name);
            if (!meta)
                continue;
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
                    return { kind: 'skipped' };
                }
                const checksum = createHash('sha256').update(content).digest('hex');
                const registryEntry = registry.get(driveFile.id);
                if (!forceRefresh && SnapshotFileRegistryRepository.isRegistryEntryUnchanged(registryEntry, driveFile.md5Checksum, checksum)) {
                    return { kind: 'skipped', snapshotKey: driveFile.meta.snapshotKey };
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
                        ? { kind: 'refreshed', snapshotKey: driveFile.meta.snapshotKey }
                        : { kind: 'skipped', snapshotKey: driveFile.meta.snapshotKey };
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
                    kind: 'processed',
                    snapshotKey: driveFile.meta.snapshotKey,
                    snapshotDate: driveFile.meta.snapshotDate,
                };
            }
            catch (error) {
                return {
                    kind: 'error',
                    fileName: driveFile.name,
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
                result.errors.push({ fileName: outcome.fileName, error: outcome.error });
                continue;
            }
            if (outcome.kind === 'refreshed') {
                result.skipped += 1;
                affectedSnapshotKeys.add(outcome.snapshotKey);
                continue;
            }
            result.processed += 1;
            affectedSnapshotKeys.add(outcome.snapshotKey);
            if (!result.processedSnapshotDates.includes(outcome.snapshotDate)) {
                result.processedSnapshotDates.push(outcome.snapshotDate);
            }
            if (!result.processedSnapshotKeys.includes(outcome.snapshotKey)) {
                result.processedSnapshotKeys.push(outcome.snapshotKey);
            }
        }
        if (affectedSnapshotKeys.size > 0) {
            const metricErrors = [];
            await Promise.all([...affectedSnapshotKeys].map(async (snapshotKey) => {
                try {
                    await SnapshotMetricsService.recomputeForSnapshotKey(snapshotKey);
                }
                catch (error) {
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
        return result;
    }
    async getPayload(snapshotKey, reportType) {
        const batch = await ReportSnapshotRepository.getBatch(snapshotKey);
        const match = batch.find((row) => row.reportType === reportType);
        return match?.payloadJson ?? null;
    }
}
