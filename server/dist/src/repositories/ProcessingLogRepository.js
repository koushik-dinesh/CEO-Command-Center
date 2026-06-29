import { execute, queryRows } from '../db/mysql.js';
import { createId } from '../db/ids.js';
import { stringifyJson } from '../db/json.js';
export class ProcessingLogRepository {
    static async create(data, executor) {
        const id = createId('plog');
        const startedAt = new Date();
        await execute('INSERT INTO processing_logs (id, dataSourceId, runType, status, startedAt) VALUES (?, ?, ?, ?, ?)', [id, data.dataSourceId, data.runType, data.status, startedAt], executor);
        return {
            id,
            dataSourceId: data.dataSourceId,
            uploadedFileId: null,
            runType: data.runType,
            status: data.status,
            startedAt,
            finishedAt: null,
            recordsRead: 0,
            recordsAccepted: 0,
            recordsRejected: 0,
            errorMessage: null,
            metadataJson: null,
        };
    }
    static async update(id, data, executor) {
        const updates = [];
        const params = [];
        for (const [key, value] of Object.entries(data)) {
            updates.push(`${key} = ?`);
            params.push(key === 'metadataJson' ? stringifyJson(value) : value);
        }
        params.push(id);
        await execute(`UPDATE processing_logs SET ${updates.join(', ')} WHERE id = ?`, params, executor);
        const rows = await queryRows('SELECT * FROM processing_logs WHERE id = ? LIMIT 1', [id], executor);
        const updated = rows[0];
        if (!updated)
            throw new Error(`Processing log ${id} not found after update`);
        return updated;
    }
    static async pruneOlderThan(retentionDays) {
        if (retentionDays <= 0)
            return 0;
        const result = await execute('DELETE FROM processing_logs WHERE startedAt < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)', [retentionDays]);
        return Number(result.affectedRows ?? 0);
    }
    static async latest(limit = 8) {
        const rows = await queryRows(`SELECT pl.*, ds.name AS dataSourceName
       FROM processing_logs pl
       INNER JOIN data_sources ds ON ds.id = pl.dataSourceId
       ORDER BY pl.startedAt DESC
       LIMIT ?`, [limit]);
        return rows.map((log) => ({
            status: log.status,
            startedAt: log.startedAt.toISOString(),
            finishedAt: log.finishedAt?.toISOString() ?? null,
            dataSourceName: log.dataSourceName,
            recordsRead: log.recordsRead,
            recordsAccepted: log.recordsAccepted,
            recordsRejected: log.recordsRejected,
            errorMessage: log.errorMessage,
        }));
    }
}
