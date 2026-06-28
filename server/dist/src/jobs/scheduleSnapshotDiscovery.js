import cron from 'node-cron';
import { env } from '../config/env.js';
import { SnapshotDiscoveryService } from '../snapshots/SnapshotDiscoveryService.js';
import { logger } from '../utils/logger.js';
import { DISCOVERY_CRON_EXPRESSIONS, isDiscoveryWindowExhausted, MAINTENANCE_CRON_EXPRESSION } from '../snapshots/snapshotSchedule.js';
let discoveryRunning = false;
let maintenanceRunning = false;
async function runDiscoveryTick() {
    if (discoveryRunning)
        return;
    discoveryRunning = true;
    const service = new SnapshotDiscoveryService();
    try {
        if (await service.shouldSkipDiscoveryWindow()) {
            logger.info('snapshot discovery skipped — today already available', { operation: 'snapshot.discovery' });
            return;
        }
        const result = await service.run('DISCOVERY');
        if (result.todaySnapshotFound) {
            logger.info('daily snapshot discovered', { operation: 'snapshot.discovery' });
        }
        else if (isDiscoveryWindowExhausted()) {
            logger.warn('discovery window ended without today snapshot', { operation: 'snapshot.discovery' });
        }
    }
    catch (error) {
        logger.error('discovery tick failed', {
            operation: 'snapshot.discovery',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
    finally {
        discoveryRunning = false;
    }
}
async function runMaintenanceTick() {
    if (maintenanceRunning)
        return;
    maintenanceRunning = true;
    try {
        await new SnapshotDiscoveryService().run('MAINTENANCE');
    }
    catch (error) {
        logger.error('maintenance sync failed', {
            operation: 'snapshot.maintenance',
            stack: error instanceof Error ? error.stack : undefined,
        });
    }
    finally {
        maintenanceRunning = false;
    }
}
export function scheduleSnapshotDiscovery() {
    if (env.NODE_ENV === 'test')
        return;
    const timezone = env.DEFAULT_TIMEZONE;
    const cronOptions = { timezone };
    for (const expression of DISCOVERY_CRON_EXPRESSIONS) {
        cron.schedule(expression, () => {
            void runDiscoveryTick();
        }, cronOptions);
    }
    cron.schedule(MAINTENANCE_CRON_EXPRESSION, () => {
        void runMaintenanceTick();
    }, cronOptions);
    logger.info('snapshot scheduler started', {
        operation: 'snapshot.scheduler',
        discoveryWindow: `${env.SNAPSHOT_DISCOVERY_START}-${env.SNAPSHOT_DISCOVERY_END}`,
        discoveryIntervalMinutes: env.SNAPSHOT_DISCOVERY_INTERVAL_MINUTES,
        maintenanceCron: env.SNAPSHOT_MAINTENANCE_CRON,
        timezone,
    });
}
