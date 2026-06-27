import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotSyncRunRepository, type SnapshotSyncRunType } from '../repositories/SnapshotSyncRunRepository.js';
import { SnapshotEngine, type SnapshotSyncResult } from '../reports/SnapshotEngine.js';
import { IngestionService } from '../ingestion/IngestionService.js';
import { todayDateKey } from './snapshotSchedule.js';

export interface SnapshotDiscoveryResult extends SnapshotSyncResult {
  runType: SnapshotSyncRunType;
  todaySnapshotFound: boolean;
  newFilesDetected: number;
  runId: string;
}

export interface SnapshotSyncStatusResponse {
  runId: string;
  running: boolean;
  status: string | null;
  scanned: number;
  processed: number;
  skipped: number;
  errors: Array<{ fileName: string; error: string }>;
  totalCached: number | null;
  todaySnapshotFound: boolean;
  newFilesDetected: number;
  errorMessage: string | null;
}

export class SnapshotDiscoveryService {
  private snapshotEngine = new SnapshotEngine();
  private ingestionService = new IngestionService();
  private static activeRunId: string | null = null;

  start(runType: SnapshotSyncRunType): Promise<{ runId: string }> {
    return this.startAsync(runType);
  }

  async startAsync(runType: SnapshotSyncRunType): Promise<{ runId: string }> {
    if (SnapshotDiscoveryService.activeRunId) {
      const active = await SnapshotSyncRunRepository.findById(SnapshotDiscoveryService.activeRunId);
      if (active && !active.finishedAt) {
        return { runId: SnapshotDiscoveryService.activeRunId };
      }
      SnapshotDiscoveryService.activeRunId = null;
    }

    const runId = await SnapshotSyncRunRepository.createPending(runType);
    SnapshotDiscoveryService.activeRunId = runId;
    void this.executeRun(runId, runType).finally(() => {
      if (SnapshotDiscoveryService.activeRunId === runId) {
        SnapshotDiscoveryService.activeRunId = null;
      }
    });
    return { runId };
  }

  async getStatus(runId: string): Promise<SnapshotSyncStatusResponse | null> {
    const run = await SnapshotSyncRunRepository.findById(runId);
    if (!run) return null;

    const running = !run.finishedAt;
    const metadata = run.metadataJson as { errors?: Array<{ fileName: string; error: string }> } | null;

    return {
      runId: run.id,
      running,
      status: running ? 'RUNNING' : run.status,
      scanned: run.scanned,
      processed: run.processed,
      skipped: run.skipped,
      errors: metadata?.errors ?? [],
      totalCached: running ? null : await ReportSnapshotRepository.count(),
      todaySnapshotFound: run.todaySnapshotFound,
      newFilesDetected: run.newFilesDetected,
      errorMessage: run.errorMessage,
    };
  }

  async run(runType: SnapshotSyncRunType): Promise<SnapshotDiscoveryResult> {
    const { runId } = await this.startAsync(runType);
    while (true) {
      const status = await this.getStatus(runId);
      if (!status || !status.running) {
        const run = await SnapshotSyncRunRepository.findById(runId);
        if (!run || !run.finishedAt) {
          throw new Error('Snapshot sync did not complete');
        }
        const metadata = run.metadataJson as { errors?: Array<{ fileName: string; error: string }> } | null;
        return {
          runType,
          runId,
          scanned: run.scanned,
          processed: run.processed,
          skipped: run.skipped,
          errors: metadata?.errors ?? [],
          processedSnapshotDates: [],
          processedSnapshotKeys: [],
          todaySnapshotFound: run.todaySnapshotFound,
          newFilesDetected: run.newFilesDetected,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  private async executeRun(runId: string, runType: SnapshotSyncRunType): Promise<void> {
    const startedAt = new Date();
    let syncResult: SnapshotSyncResult = {
      scanned: 0,
      processed: 0,
      skipped: 0,
      errors: [],
      processedSnapshotDates: [],
      processedSnapshotKeys: [],
    };

    try {
      if (runType === 'MANUAL') {
        const ingestion = await this.ingestionService.runAll('manual', {
          forceSnapshotRefresh: true,
          alwaysRecalculateKpis: true,
        });
        syncResult = ingestion.snapshotResult;
      } else {
        syncResult = await this.snapshotEngine.syncFromDrive();
      }
      const today = todayDateKey();
      const todaySnapshotFound = await ReportSnapshotRepository.hasSnapshotForDate(today);
      const newFilesDetected = syncResult.processed;
      const status = syncResult.errors.length > 0
        ? 'PARTIAL'
        : newFilesDetected > 0
          ? 'SUCCESS'
          : 'NO_NEW_FILES';

      await SnapshotSyncRunRepository.complete(runId, {
        status,
        scanned: syncResult.scanned,
        processed: syncResult.processed,
        skipped: syncResult.skipped,
        newFilesDetected,
        todaySnapshotFound,
        errorMessage: syncResult.errors.length > 0 ? `${syncResult.errors.length} file(s) failed processing` : null,
        metadataJson: {
          errors: syncResult.errors.slice(0, 10),
          processedSnapshotDates: syncResult.processedSnapshotDates,
          processedSnapshotKeys: syncResult.processedSnapshotKeys,
        },
        finishedAt: new Date(),
      });

      console.info(
        `[snapshot-discovery:${runType}] runId=${runId} scanned=${syncResult.scanned} processed=${syncResult.processed} skipped=${syncResult.skipped} todayFound=${todaySnapshotFound}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Snapshot sync failed';
      await SnapshotSyncRunRepository.complete(runId, {
        status: 'FAILED',
        scanned: syncResult.scanned,
        processed: syncResult.processed,
        skipped: syncResult.skipped,
        newFilesDetected: 0,
        todaySnapshotFound: false,
        errorMessage,
        metadataJson: syncResult.errors.length > 0 ? { errors: syncResult.errors.slice(0, 10) } : undefined,
        finishedAt: new Date(),
      });
      console.error(`[snapshot-discovery:${runType}] runId=${runId} failed after ${Date.now() - startedAt.getTime()}ms`, error);
    }
  }

  async shouldSkipDiscoveryWindow(): Promise<boolean> {
    const today = todayDateKey();
    if (await ReportSnapshotRepository.hasSnapshotForDate(today)) return true;
    return SnapshotSyncRunRepository.hasTodaySnapshotDiscovery(today);
  }
}
