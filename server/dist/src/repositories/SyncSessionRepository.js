import { createId } from '../db/ids.js';
import { execute, queryRows, transaction } from '../db/mysql.js';
export class SyncSessionRepository {
    static async create(input) {
        const sessionId = createId('sync');
        await transaction(async (connection) => {
            await execute(`INSERT INTO sync_sessions
         (id, source, syncType, status, totalFilesProcessed, durationMs, errorMessage, startedAt, completedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                sessionId,
                input.source,
                input.syncType,
                input.status,
                input.totalFilesProcessed,
                input.durationMs,
                input.errorMessage ?? null,
                input.startedAt,
                input.completedAt,
            ], connection);
            for (const file of input.files) {
                await execute(`INSERT INTO sync_session_files
           (id, syncSessionId, fileName, fetchedAt, status, errorMessage)
           VALUES (?, ?, ?, ?, ?, ?)`, [
                    createId('ssf'),
                    sessionId,
                    file.fileName,
                    file.fetchedAt,
                    file.status,
                    file.errorMessage ?? null,
                ], connection);
            }
        });
        return sessionId;
    }
    static async listBetween(start, end) {
        const rows = await queryRows(`SELECT *
       FROM sync_sessions
       WHERE completedAt >= ? AND completedAt <= ?
       ORDER BY completedAt DESC`, [start, end]);
        return rows;
    }
    static async pruneToMaxSessions(maxSessions) {
        if (maxSessions <= 0)
            return 0;
        const countRow = await queryRows('SELECT COUNT(*) AS count FROM sync_sessions');
        const total = Number(countRow[0]?.count ?? 0);
        const excess = total - maxSessions;
        if (excess <= 0)
            return 0;
        const result = await execute('DELETE FROM sync_sessions ORDER BY completedAt ASC LIMIT ?', [excess]);
        return Number(result.affectedRows ?? 0);
    }
    static async listFilesForSessions(sessionIds) {
        if (sessionIds.length === 0)
            return [];
        const placeholders = sessionIds.map(() => '?').join(', ');
        const rows = await queryRows(`SELECT *
       FROM sync_session_files
       WHERE syncSessionId IN (${placeholders})
       ORDER BY fileName ASC`, sessionIds);
        return rows;
    }
}
