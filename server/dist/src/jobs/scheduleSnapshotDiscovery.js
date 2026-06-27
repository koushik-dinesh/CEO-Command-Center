import cron from 'node-cron';
import { env } from '../config/env.js';
import { SnapshotDiscoveryService } from '../snapshots/SnapshotDiscoveryService.js';
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
            console.info('[snapshot-scheduler] Today\'s snapshot already available — discovery window complete');
            return;
        }
        const result = await service.run('DISCOVERY');
        if (result.todaySnapshotFound) {
            console.info('[snapshot-scheduler] Daily snapshot discovered — switching to maintenance mode until tomorrow');
        }
        else if (isDiscoveryWindowExhausted()) {
            console.warn('[snapshot-scheduler] Discovery window ended without today\'s snapshot — will retry during maintenance');
        }
    }
    catch (error) {
        console.error('[snapshot-scheduler] Discovery tick failed', error);
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
        console.error('[snapshot-scheduler] Maintenance sync failed', error);
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
    console.info(`[snapshot-scheduler] Discovery window ${env.SNAPSHOT_DISCOVERY_START}-${env.SNAPSHOT_DISCOVERY_END} IST (every ${env.SNAPSHOT_DISCOVERY_INTERVAL_MINUTES} min); maintenance: ${env.SNAPSHOT_MAINTENANCE_CRON}`);
}
