import cron from 'node-cron';
import { env } from '../config/env.js';
import { IngestionService } from '../ingestion/IngestionService.js';
export function scheduleIngestionJob() {
    if (env.NODE_ENV === 'test')
        return;
    cron.schedule(env.INGESTION_CRON, () => {
        new IngestionService().runAll('scheduled').catch((error) => {
            console.error('Scheduled ingestion failed', error);
        });
    });
}
