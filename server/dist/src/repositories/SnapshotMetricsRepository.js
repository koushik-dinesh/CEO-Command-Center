import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';
import { formatSnapshotDateFromDb, normalizeSnapshotDate, parseDateFromSnapshotKey } from '../snapshots/snapshotDate.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
function toNumber(value) {
    if (value === null)
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function mapRow(row) {
    const snapshotDate = normalizeSnapshotDate(row.snapshotDate)
        ?? parseDateFromSnapshotKey(row.snapshotKey)
        ?? formatSnapshotDateFromDb(row.snapshotDate);
    return {
        snapshotKey: row.snapshotKey,
        snapshotDate,
        snapshotTimestamp: row.snapshotTimestamp,
        revenue: toNumber(row.revenue),
        grossProfit: toNumber(row.grossProfit),
        grossMargin: toNumber(row.grossMargin),
        ytdCogs: toNumber(row.ytdCogs),
        daysElapsed: row.daysElapsed,
        inventoryDays: toNumber(row.inventoryDays),
        itr: toNumber(row.itr),
        inventoryValue: toNumber(row.inventoryValue),
        deadStock: toNumber(row.deadStock),
        slowMovingStock: toNumber(row.slowMovingStock),
        reportCount: row.reportCount,
        completeness: Number(row.completeness),
        fileNames: parseJsonField(row.fileNames) ?? [],
        computedAt: row.computedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
export class SnapshotMetricsRepository {
    static async findByKey(snapshotKey) {
        const row = await queryOne(`SELECT * FROM snapshot_metrics
       WHERE snapshotKey = ? AND reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       LIMIT 1`, [snapshotKey]);
        return row ? mapRow(row) : null;
    }
    static async upsert(data) {
        await execute(`INSERT INTO snapshot_metrics
       (snapshotKey, snapshotDate, snapshotTimestamp, revenue, grossProfit, grossMargin,
        ytdCogs, daysElapsed, inventoryDays, itr,
        inventoryValue, deadStock, slowMovingStock, reportCount, completeness, fileNames, computedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         snapshotDate = VALUES(snapshotDate),
         snapshotTimestamp = VALUES(snapshotTimestamp),
         revenue = VALUES(revenue),
         grossProfit = VALUES(grossProfit),
         grossMargin = VALUES(grossMargin),
         ytdCogs = VALUES(ytdCogs),
         daysElapsed = VALUES(daysElapsed),
         inventoryDays = VALUES(inventoryDays),
         itr = VALUES(itr),
         inventoryValue = VALUES(inventoryValue),
         deadStock = VALUES(deadStock),
         slowMovingStock = VALUES(slowMovingStock),
         reportCount = VALUES(reportCount),
         completeness = VALUES(completeness),
         fileNames = VALUES(fileNames),
         computedAt = VALUES(computedAt),
         updatedAt = CURRENT_TIMESTAMP(3)`, [
            data.snapshotKey,
            data.snapshotDate,
            data.snapshotTimestamp,
            data.revenue,
            data.grossProfit,
            data.grossMargin,
            data.ytdCogs,
            data.daysElapsed,
            data.inventoryDays,
            data.itr,
            data.inventoryValue,
            data.deadStock,
            data.slowMovingStock,
            data.reportCount,
            data.completeness,
            stringifyJson(data.fileNames),
            data.computedAt,
        ]);
        const row = await this.findByKey(data.snapshotKey);
        if (!row)
            throw new Error(`Snapshot metrics ${data.snapshotKey} not found after upsert`);
        return row;
    }
    static async listHistory(limit = 120) {
        const rows = await queryRows(`SELECT * FROM snapshot_metrics
       WHERE reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ORDER BY snapshotTimestamp ASC
       LIMIT ?`, [limit]);
        return rows.map(mapRow);
    }
    static async deleteByKey(snapshotKey) {
        await execute('DELETE FROM snapshot_metrics WHERE snapshotKey = ?', [snapshotKey]);
    }
    static async deleteIncomplete() {
        const result = await execute(`DELETE FROM snapshot_metrics WHERE reportCount < ${REQUIRED_SNAPSHOT_REPORT_COUNT}`);
        return result.affectedRows ?? 0;
    }
    static async count() {
        const row = await queryOne('SELECT COUNT(*) AS total FROM snapshot_metrics');
        return row?.total ?? 0;
    }
    static async listDistinctSnapshotKeys() {
        const rows = await queryRows('SELECT DISTINCT snapshotKey FROM report_snapshots ORDER BY snapshotKey');
        return rows.map((row) => row.snapshotKey);
    }
}
