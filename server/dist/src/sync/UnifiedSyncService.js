import { IngestionService } from '../ingestion/IngestionService.js';
import { persistSyncSession, pruneSyncHistory } from '../ingestion/syncHistoryService.js';
import { logger } from '../utils/logger.js';
export class UnifiedSyncService {
    ingestionService = new IngestionService();
    async run(options) {
        const startedAt = new Date();
        const runType = options.syncType === 'MANUAL' ? 'manual' : 'scheduled';
        const { syncType, ...ingestionOptions } = options;
        try {
            const result = await this.ingestionService.runAll(runType, ingestionOptions);
            const completedAt = new Date();
            await persistSyncSession({
                syncType,
                startedAt,
                completedAt,
                sourceResults: result.sourceResults,
                snapshotResult: result.snapshotResult,
            });
            await pruneSyncHistory();
            logger.info('unified sync completed', {
                operation: 'sync.unified',
                syncType,
                changedSources: result.changedSourceCodes,
                recalculatedKpis: result.recalculatedKpiCodes,
                snapshotsProcessed: result.snapshotResult.processed,
            });
            return result;
        }
        catch (error) {
            const completedAt = new Date();
            await persistSyncSession({
                syncType,
                startedAt,
                completedAt,
                status: 'FAILED',
                errorMessage: error instanceof Error ? error.message : 'Unified sync failed',
            });
            await pruneSyncHistory();
            throw error;
        }
    }
}
