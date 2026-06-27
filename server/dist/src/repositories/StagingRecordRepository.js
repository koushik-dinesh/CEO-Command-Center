import { execute, queryRows } from '../db/mysql.js';
import { createId } from '../db/ids.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
function mapRow(row) {
    return { ...row, normalized: parseJsonField(row.normalized), raw: parseJsonField(row.raw) };
}
export class StagingRecordRepository {
    static async createMany(records, executor) {
        if (records.length === 0)
            return;
        const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const params = records.flatMap((record) => [
            createId('stage'),
            record.dataSourceId,
            record.sourceDate,
            record.sourceKey ?? null,
            stringifyJson(record.normalized),
            stringifyJson(record.raw),
        ]);
        await execute(`INSERT INTO staging_records (id, dataSourceId, sourceDate, sourceKey, normalized, raw) VALUES ${placeholders}`, params, executor);
    }
    static async findForPeriod(periodStart, periodEnd) {
        const rows = await queryRows(`SELECT sr.*, ds.code AS dataSourceCode
       FROM staging_records sr
       INNER JOIN data_sources ds ON ds.id = sr.dataSourceId
       WHERE sr.sourceDate >= ? AND sr.sourceDate <= ?`, [periodStart, periodEnd]);
        return rows.map(mapRow);
    }
    static async revenueSnapshots(limit = 8) {
        const rows = await queryRows(`SELECT *
       FROM (
         SELECT
           sr.sourceDate,
           JSON_UNQUOTE(JSON_EXTRACT(sr.normalized, '$.sourceFileName')) AS sourceFileName,
           SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(sr.normalized, '$.revenueYtd')) AS DECIMAL(20, 4))) AS valueDecimal
         FROM staging_records sr
         INNER JOIN data_sources ds ON ds.id = sr.dataSourceId
         WHERE ds.code = 'REVENUE_CSV'
           AND JSON_EXTRACT(sr.normalized, '$.revenueYtd') IS NOT NULL
         GROUP BY sr.sourceDate, sourceFileName
         ORDER BY sr.sourceDate DESC
         LIMIT ?
       ) snapshots
       ORDER BY sourceDate ASC`, [limit]);
        return rows
            .filter((row) => row.valueDecimal !== null)
            .map((row) => ({ calculatedAt: row.sourceDate.toISOString(), value: String(row.valueDecimal) }));
    }
}
