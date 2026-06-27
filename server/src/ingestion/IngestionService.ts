import { createHash } from 'node:crypto';
import { transaction } from '../db/mysql.js';
import { ProcessingStatus, SourceProvider, SourceType, type DataSourceRow } from '../db/types.js';
import { KpiCalculationService } from '../kpis/KpiCalculationService.js';
import { DataSourceMutationRepository } from '../repositories/DataSourceMutationRepository.js';
import { ProcessingLogRepository } from '../repositories/ProcessingLogRepository.js';
import { StagingRecordRepository } from '../repositories/StagingRecordRepository.js';
import { UploadedFileRepository } from '../repositories/UploadedFileRepository.js';
import { SnapshotEngine, type SnapshotSyncResult } from '../reports/SnapshotEngine.js';
import { DataSourceService } from '../services/DataSourceService.js';
import { parseCsv, sheetValuesToRows } from './csvParser.js';
import { GoogleDriveService } from './googleDriveService.js';
import { GoogleSheetsService } from './googleSheetsService.js';
import { normalizeRows } from './sourceAdapters.js';
import type { SourcePayload } from './types.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';

function checksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function processingMetadata(source: DataSourceRow, normalized: ReturnType<typeof normalizeRows>) {
  if (source.code !== 'COPQ_DASHBOARD_SHEET') {
    return { rejected: normalized.rejected.slice(0, 25) };
  }

  const extracted = normalized.accepted[0]?.normalized ?? null;
  return {
    rejected: normalized.rejected.slice(0, 25),
    workbookLoaded: extracted?.sourceWorkbookName ?? null,
    dashboardSheetFound: extracted?.sourceSheetName ?? null,
    cellValueExtracted: extracted ? {
      totalCopqCell: extracted.sourceCell,
      totalCopq: extracted.totalCopq,
      copqYtd: extracted.copqYtd,
      copqMtd: extracted.copqMtd,
      copqQtd: extracted.copqQtd,
      copqBeforeQaClearanceCell: extracted.copqBeforeQaClearanceCell,
      copqBeforeQaClearance: extracted.copqBeforeQaClearance,
      qaSavedAmountCell: extracted.qaSavedAmountCell,
      qaSavedAmount: extracted.qaSavedAmount,
      formula: extracted.sourceCellFormula,
      ncRecordsSheetName: extracted.ncRecordsSheetName,
      copqMtdRowCount: extracted.copqMtdRowCount,
      copqQtdRowCount: extracted.copqQtdRowCount,
      copqReferenceDate: extracted.copqReferenceDate,
    } : null,
  };
}

export interface IngestionRunOptions {
  /** Re-download snapshot CSVs from Google Drive and recompute dashboard metrics. */
  forceSnapshotRefresh?: boolean;
  /** Recompute KPI values from staging even when no new Drive files were ingested. */
  alwaysRecalculateKpis?: boolean;
}

export interface IngestionRunResult {
  sourceResults: Array<{ sourceCode: string; status: string; processingLogId: string }>;
  snapshotResult: SnapshotSyncResult;
}

export class IngestionService {
  private driveService = new GoogleDriveService();
  private sheetsService = new GoogleSheetsService();
  private kpiCalculationService = new KpiCalculationService();
  private snapshotEngine = new SnapshotEngine();

  async runAll(runType = 'manual', options: IngestionRunOptions = {}): Promise<IngestionRunResult> {
    const sources = await DataSourceService.activeSources();
    const results = [];
    let lastSuccessfulRunId: string | undefined;

    for (const source of sources) {
      const result = await this.processSource(source, runType);
      results.push(result);
      if (result.status === ProcessingStatus.SUCCESS || result.status === ProcessingStatus.PARTIAL) {
        lastSuccessfulRunId = result.processingLogId;
      }
    }

    if (lastSuccessfulRunId || options.alwaysRecalculateKpis || runType === 'manual') {
      await this.kpiCalculationService.calculateAndPersist({ sourceRunId: lastSuccessfulRunId });
    }

    const emptySnapshotResult: SnapshotSyncResult = {
      scanned: 0,
      processed: 0,
      skipped: 0,
      errors: [],
      processedSnapshotDates: [],
      processedSnapshotKeys: [],
    };
    let snapshotResult = emptySnapshotResult;
    try {
      snapshotResult = await this.snapshotEngine.syncFromDrive({
        forceRefresh: options.forceSnapshotRefresh === true,
      });
    } catch (error) {
      console.warn('[ingestion:snapshot-engine] Snapshot sync failed', error);
      snapshotResult = {
        ...emptySnapshotResult,
        errors: [{ fileName: 'snapshot-sync', error: error instanceof Error ? error.message : 'Snapshot sync failed' }],
      };
    }
    return { sourceResults: results, snapshotResult };
  }

  private async fetchSourcePayloads(source: DataSourceRow): Promise<SourcePayload[]> {
    if (source.provider === SourceProvider.GOOGLE_DRIVE && source.sourceType === SourceType.CSV) {
      if (source.code === 'REVENUE_CSV') return this.driveService.fetchMatchingCsvs(source);
      const payload = await this.driveService.fetchLatestCsv(source);
      return payload ? [payload] : [];
    }
    if (source.provider === SourceProvider.GOOGLE_SHEETS && source.sourceType === SourceType.GOOGLE_SHEET) {
      return [await this.sheetsService.fetchRange(source)];
    }
    throw new Error(`Unsupported source provider/type for ${source.code}`);
  }

  private async processSource(source: DataSourceRow, runType: string) {
    const processingLog = await ProcessingLogRepository.create({ dataSourceId: source.id, runType, status: ProcessingStatus.PROCESSING });

    try {
      const payloads = await this.fetchSourcePayloads(source);
      if (payloads.length === 0) {
        const updated = await ProcessingLogRepository.update(processingLog.id, {
          status: ProcessingStatus.SKIPPED,
          finishedAt: new Date(),
          errorMessage: 'No source file found',
        });
        return { sourceCode: source.code, status: updated.status, processingLogId: updated.id };
      }

      return await transaction(async (connection) => {
        let uploadedFileId: string | null = null;
        let recordsRead = 0;
        let recordsAccepted = 0;
        let recordsRejected = 0;
        const rejected: Array<unknown> = [];
        const extracted: ReturnType<typeof normalizeRows>['accepted'] = [];

        for (const payload of payloads) {
          const contentChecksum = checksum(payload.content);
          const providerFileVersionId = `${payload.providerFileId}:${contentChecksum.slice(0, 16)}`;
          const existing = await UploadedFileRepository.findDuplicate(source.id, providerFileVersionId, contentChecksum, connection);
          if (existing) continue;

          const uploadedFile = await UploadedFileRepository.create({
            dataSourceId: source.id,
            providerFileId: providerFileVersionId,
            fileName: payload.fileName,
            mimeType: payload.mimeType ?? null,
            checksum: contentChecksum,
            modifiedTime: payload.modifiedTime ?? null,
            sizeBytes: payload.sizeBytes ?? null,
            status: ProcessingStatus.PROCESSING,
          }, connection);
          uploadedFileId = uploadedFile.id;

          const rows = source.sourceType === SourceType.CSV ? parseCsv(payload.content) : sheetValuesToRows(payload.content);
          const normalized = normalizeRows(source, rows, { sourceDate: payload.modifiedTime ?? new Date(), sourceFileName: payload.fileName });
          if (source.code === 'COPQ_DASHBOARD_SHEET') {
            for (const record of normalized.accepted) {
              logO34Stage('STAGING O34', {
                sourceKey: record.sourceKey,
                normalizedTotalCopq: record.normalized.totalCopq,
                normalizedSourceCell: record.normalized.sourceCell,
                rawCellKeys: record.raw && typeof record.raw === 'object' && (record.raw as { cells?: unknown }).cells
                  ? Object.keys((record.raw as { cells: Record<string, unknown> }).cells)
                  : [],
                rawTotalCopq: record.raw && typeof record.raw === 'object'
                  ? (record.raw as { cells?: { totalCopq?: unknown } }).cells?.totalCopq ?? null
                  : null,
              }, record.normalized as Record<string, unknown>);
            }
            if (normalized.rejected.length > 0) {
              logO34Stage('STAGING O34 REJECTED', normalized.rejected);
            }
          }
          await StagingRecordRepository.createMany(normalized.accepted.map((record) => ({
            dataSourceId: source.id,
            sourceDate: record.sourceDate,
            sourceKey: record.sourceKey,
            normalized: record.normalized,
            raw: record.raw,
          })), connection);

          recordsRead += rows.length;
          recordsAccepted += normalized.accepted.length;
          recordsRejected += normalized.rejected.length;
          rejected.push(...normalized.rejected);
          extracted.push(...normalized.accepted);
          const fileStatus = normalized.rejected.length > 0 ? ProcessingStatus.PARTIAL : ProcessingStatus.SUCCESS;
          await UploadedFileRepository.updateStatus(uploadedFile.id, fileStatus, connection);
        }

        await DataSourceMutationRepository.updateLastCheckedAt(source.id, connection);
        if (!uploadedFileId) {
          const updated = await ProcessingLogRepository.update(processingLog.id, {
            status: ProcessingStatus.SKIPPED,
            finishedAt: new Date(),
            metadataJson: { reason: 'Duplicate provider file or checksum' },
          }, connection);
          return { sourceCode: source.code, status: updated.status, processingLogId: updated.id };
        }

        const finalStatus = recordsRejected > 0 ? ProcessingStatus.PARTIAL : ProcessingStatus.SUCCESS;
        const updated = await ProcessingLogRepository.update(processingLog.id, {
          uploadedFileId,
          status: finalStatus,
          finishedAt: new Date(),
          recordsRead,
          recordsAccepted,
          recordsRejected,
          metadataJson: processingMetadata(source, { accepted: extracted, rejected: rejected as ReturnType<typeof normalizeRows>['rejected'] }),
        }, connection);
        return { sourceCode: source.code, status: updated.status, processingLogId: updated.id };
      });
    } catch (error) {
      const updated = await ProcessingLogRepository.update(processingLog.id, {
        status: ProcessingStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown ingestion error',
      });
      return { sourceCode: source.code, status: updated.status, processingLogId: updated.id };
    }
  }
}
