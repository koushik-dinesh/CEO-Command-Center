import { execute, queryOne } from '../db/mysql.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
function mapRow(row) {
    return {
        ...row,
        referenceDate: String(row.referenceDate).slice(0, 10),
        financialYearStart: String(row.financialYearStart).slice(0, 10),
        monthStart: String(row.monthStart).slice(0, 10),
        quarterStart: String(row.quarterStart).slice(0, 10),
        headlineJson: row.headlineJson === null ? null : parseJsonField(row.headlineJson),
    };
}
export class CopqAnalyticsMetaRepository {
    static async findByDataSourceId(dataSourceId) {
        const row = await queryOne('SELECT * FROM copq_analytics_meta WHERE dataSourceId = ? LIMIT 1', [dataSourceId]);
        return row ? mapRow(row) : null;
    }
    static async upsert(data, executor) {
        await execute(`INSERT INTO copq_analytics_meta
       (dataSourceId, referenceDate, financialYearStart, monthStart, quarterStart,
        sheetName, sourceWorkbook, lastUpdated, recordCount, rejectedRowCount,
        dateColumnUsed, copqColumnUsed, headlineJson, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         referenceDate = VALUES(referenceDate),
         financialYearStart = VALUES(financialYearStart),
         monthStart = VALUES(monthStart),
         quarterStart = VALUES(quarterStart),
         sheetName = VALUES(sheetName),
         sourceWorkbook = VALUES(sourceWorkbook),
         lastUpdated = VALUES(lastUpdated),
         recordCount = VALUES(recordCount),
         rejectedRowCount = VALUES(rejectedRowCount),
         dateColumnUsed = VALUES(dateColumnUsed),
         copqColumnUsed = VALUES(copqColumnUsed),
         headlineJson = VALUES(headlineJson),
         syncedAt = VALUES(syncedAt),
         updatedAt = CURRENT_TIMESTAMP(3)`, [
            data.dataSourceId,
            data.referenceDate,
            data.financialYearStart,
            data.monthStart,
            data.quarterStart,
            data.sheetName,
            data.sourceWorkbook,
            data.lastUpdated,
            data.recordCount,
            data.rejectedRowCount,
            data.dateColumnUsed,
            data.copqColumnUsed,
            data.headlineJson ? stringifyJson(data.headlineJson) : null,
            data.syncedAt,
        ], executor);
    }
}
