import { createId } from '../db/ids.js';
import { execute, queryOne } from '../db/mysql.js';
import { stringifyJson } from '../db/json.js';
export class SnapshotSyncRunRepository {
    static async createPending(runType) {
        const id = createId('ssr');
        await execute(`INSERT INTO snapshot_sync_runs
       (id, runType, status, scanned, processed, skipped, newFilesDetected, todaySnapshotFound, errorMessage, metadataJson, startedAt, finishedAt)
       VALUES (?, ?, 'NO_NEW_FILES', 0, 0, 0, 0, FALSE, NULL, NULL, ?, NULL)`, [id, runType, new Date()]);
        return id;
    }
    static async findById(id) {
        const row = await queryOne('SELECT * FROM snapshot_sync_runs WHERE id = ? LIMIT 1', [id]);
        return row ?? null;
    }
    static async complete(id, data) {
        await execute(`UPDATE snapshot_sync_runs
       SET status = ?, scanned = ?, processed = ?, skipped = ?, newFilesDetected = ?, todaySnapshotFound = ?,
           errorMessage = ?, metadataJson = ?, finishedAt = ?
       WHERE id = ?`, [
            data.status,
            data.scanned,
            data.processed,
            data.skipped,
            data.newFilesDetected,
            data.todaySnapshotFound,
            data.errorMessage ?? null,
            data.metadataJson ? stringifyJson(data.metadataJson) : null,
            data.finishedAt,
            id,
        ]);
    }
    static async create(data) {
        const id = createId('ssr');
        await execute(`INSERT INTO snapshot_sync_runs
       (id, runType, status, scanned, processed, skipped, newFilesDetected, todaySnapshotFound, errorMessage, metadataJson, startedAt, finishedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            data.runType,
            data.status,
            data.scanned,
            data.processed,
            data.skipped,
            data.newFilesDetected,
            data.todaySnapshotFound,
            data.errorMessage ?? null,
            data.metadataJson ? stringifyJson(data.metadataJson) : null,
            data.startedAt,
            data.finishedAt,
        ]);
        return id;
    }
    static async hasTodaySnapshotDiscovery(todayDate) {
        const row = await queryOne(`SELECT COUNT(*) AS found FROM snapshot_sync_runs
       WHERE runType = 'DISCOVERY' AND todaySnapshotFound = TRUE AND DATE(startedAt) = ?`, [todayDate]);
        return (row?.found ?? 0) > 0;
    }
}
