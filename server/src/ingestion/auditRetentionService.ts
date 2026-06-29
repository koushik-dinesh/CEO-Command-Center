import { env } from '../config/env.js';
import { KpiHistoryRepository } from '../repositories/KpiHistoryRepository.js';
import { ProcessingLogRepository } from '../repositories/ProcessingLogRepository.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotSyncRunRepository } from '../repositories/SnapshotSyncRunRepository.js';
import { SyncSessionRepository } from '../repositories/SyncSessionRepository.js';
import { UploadedFileRepository } from '../repositories/UploadedFileRepository.js';
import { logger } from '../utils/logger.js';

export interface AuditRetentionResult {
  processingLogsDeleted: number;
  syncSessionsDeleted: number;
  snapshotSyncRunsDeleted: number;
  uploadedFilesDeleted: number;
  kpiHistoryDeletedByAge: number;
  kpiHistoryDeletedByCount: number;
  reportSnapshotsDeleted: number;
  snapshotMetricsDeleted: number;
}

export async function pruneAuditTables(): Promise<AuditRetentionResult> {
  const processingLogsDeleted = await ProcessingLogRepository.pruneOlderThan(env.PROCESSING_LOG_RETENTION_DAYS);

  const [
    syncSessionsDeleted,
    snapshotSyncRunsDeleted,
    uploadedFilesDeleted,
    kpiHistoryDeletedByAge,
    kpiHistoryDeletedByCount,
    snapshotPrune,
  ] = await Promise.all([
    SyncSessionRepository.pruneToMaxSessions(env.SYNC_HISTORY_RETENTION_COUNT),
    SnapshotSyncRunRepository.pruneOlderThan(env.SNAPSHOT_SYNC_RUN_RETENTION_DAYS),
    UploadedFileRepository.pruneUnreferencedOlderThan(env.UPLOADED_FILE_RETENTION_DAYS),
    KpiHistoryRepository.pruneOlderThan(env.KPI_VALUE_HISTORY_RETENTION_DAYS),
    KpiHistoryRepository.pruneExcessPerKpi(env.KPI_VALUE_HISTORY_MAX_ROWS_PER_KPI),
    ReportSnapshotRepository.pruneOlderThan(env.REPORT_SNAPSHOT_RETENTION_DAYS),
  ]);

  const result: AuditRetentionResult = {
    processingLogsDeleted,
    syncSessionsDeleted,
    snapshotSyncRunsDeleted,
    uploadedFilesDeleted,
    kpiHistoryDeletedByAge,
    kpiHistoryDeletedByCount,
    reportSnapshotsDeleted: snapshotPrune.snapshots,
    snapshotMetricsDeleted: snapshotPrune.metrics,
  };

  const totalDeleted = Object.values(result).reduce((sum, count) => sum + count, 0);
  if (totalDeleted > 0) {
    logger.info('audit retention prune completed', {
      operation: 'audit.retention',
      ...result,
    });
  }

  return result;
}
