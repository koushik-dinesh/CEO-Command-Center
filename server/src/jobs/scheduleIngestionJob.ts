import cron from 'node-cron';
import { env } from '../config/env.js';
import { UnifiedSyncService } from '../sync/UnifiedSyncService.js';
import { logger } from '../utils/logger.js';

export function scheduleIngestionJob() {
  if (env.NODE_ENV === 'test') return;

  cron.schedule(env.INGESTION_CRON, () => {
    new UnifiedSyncService().run({ syncType: 'AUTOMATIC' }).catch((error) => {
      logger.error('scheduled ingestion failed', {
        operation: 'ingestion.scheduled',
        stack: error instanceof Error ? error.stack : undefined,
      });
    });
  }, { timezone: env.DEFAULT_TIMEZONE });

  logger.info('ingestion scheduler started', {
    operation: 'ingestion.scheduler',
    cron: env.INGESTION_CRON,
    timezone: env.DEFAULT_TIMEZONE,
  });
}
