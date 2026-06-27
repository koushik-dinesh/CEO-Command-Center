import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
/** Fetches latest COPQ staging without sorting large JSON blobs in MySQL. */
export async function getLatestCopqStagingRecord() {
    const latest = await queryOne(`SELECT sr.id
     FROM staging_records sr
     INNER JOIN data_sources ds ON ds.id = sr.dataSourceId
     WHERE ds.code = 'COPQ_DASHBOARD_SHEET'
     ORDER BY sr.createdAt DESC
     LIMIT 1`);
    if (!latest?.id)
        return null;
    const row = await queryOne(`SELECT sr.sourceKey, sr.normalized, sr.raw, sr.createdAt
     FROM staging_records sr
     WHERE sr.id = ?
     LIMIT 1`, [latest.id]);
    if (!row)
        return null;
    return {
        sourceKey: row.sourceKey,
        normalized: parseJsonField(row.normalized),
        raw: parseJsonField(row.raw),
        createdAt: row.createdAt,
    };
}
