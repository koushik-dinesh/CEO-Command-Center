import { formatSnapshotDateFromDb, normalizeSnapshotDate, parseDateFromSnapshotKey } from '../snapshots/snapshotDate.js';
import { createId } from '../db/ids.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';
const COMPLETE_SNAPSHOT_KEYS_SUBQUERY = `
  SELECT snapshotKey
  FROM report_snapshots
  GROUP BY snapshotKey
  HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
`;
function mapRow(row) {
    const snapshotDate = normalizeSnapshotDate(row.snapshotDate)
        ?? parseDateFromSnapshotKey(row.snapshotKey)
        ?? formatSnapshotDateFromDb(row.snapshotDate);
    return {
        ...row,
        snapshotDate,
        payloadJson: parseJsonField(row.payloadJson),
    };
}
export class ReportSnapshotRepository {
    static async findByChecksum(reportType, checksum) {
        const row = await queryOne('SELECT * FROM report_snapshots WHERE reportType = ? AND checksum = ? LIMIT 1', [reportType, checksum]);
        return row ? mapRow(row) : null;
    }
    static async upsert(data) {
        const id = createId('snap');
        const processedAt = new Date();
        await execute(`INSERT INTO report_snapshots
       (id, reportType, snapshotKey, snapshotDate, snapshotTimestamp, providerFileId, fileName, checksum, payloadJson, processedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         snapshotKey = VALUES(snapshotKey),
         snapshotDate = VALUES(snapshotDate),
         snapshotTimestamp = VALUES(snapshotTimestamp),
         fileName = VALUES(fileName),
         checksum = VALUES(checksum),
         payloadJson = VALUES(payloadJson),
         processedAt = VALUES(processedAt),
         updatedAt = CURRENT_TIMESTAMP(3)`, [
            id,
            data.reportType,
            data.snapshotKey,
            data.snapshotDate,
            data.snapshotTimestamp,
            data.providerFileId,
            data.fileName,
            data.checksum,
            stringifyJson(data.payloadJson),
            processedAt,
        ]);
        const row = await queryOne('SELECT * FROM report_snapshots WHERE reportType = ? AND providerFileId = ? LIMIT 1', [data.reportType, data.providerFileId]);
        if (!row)
            throw new Error(`Snapshot not found after upsert for ${data.fileName}`);
        return mapRow(row);
    }
    static async listBatches(limit = 200) {
        const rows = await queryRows(`SELECT snapshotKey, snapshotDate, MAX(snapshotTimestamp) AS snapshotTimestamp,
              GROUP_CONCAT(DISTINCT reportType ORDER BY reportType) AS reportTypes,
              COUNT(DISTINCT reportType) AS reportCount
       FROM report_snapshots
       GROUP BY snapshotKey, snapshotDate
       HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ORDER BY snapshotTimestamp DESC
       LIMIT ?`, [limit]);
        return rows.map((row) => ({
            snapshotKey: row.snapshotKey,
            snapshotDate: row.snapshotDate,
            snapshotTimestamp: row.snapshotTimestamp.toISOString(),
            reportTypes: row.reportTypes.split(','),
            completeness: Number(row.reportCount) / REQUIRED_SNAPSHOT_REPORT_COUNT,
        }));
    }
    static async getBatch(snapshotKey) {
        const rows = await queryRows(`SELECT id, reportType, snapshotKey, snapshotDate, snapshotTimestamp, providerFileId, fileName, checksum, payloadJson, processedAt, createdAt, updatedAt
       FROM report_snapshots WHERE snapshotKey = ? ORDER BY reportType`, [snapshotKey]);
        return rows.map(mapRow);
    }
    static async getLatestBatch() {
        const latest = await queryOne(`SELECT snapshotKey FROM report_snapshots
       WHERE snapshotKey IN (${COMPLETE_SNAPSHOT_KEYS_SUBQUERY})
       ORDER BY snapshotTimestamp DESC LIMIT 1`);
        if (!latest)
            return [];
        return this.getBatch(latest.snapshotKey);
    }
    static async isCompleteSnapshotKey(snapshotKey) {
        const row = await queryOne('SELECT COUNT(DISTINCT reportType) AS reportCount FROM report_snapshots WHERE snapshotKey = ?', [snapshotKey]);
        return (row?.reportCount ?? 0) >= REQUIRED_SNAPSHOT_REPORT_COUNT;
    }
    static async historyForType(reportType, limit = 120) {
        const rows = await queryRows(`SELECT rs.snapshotKey, rs.snapshotDate, rs.snapshotTimestamp, rs.payloadJson
       FROM report_snapshots rs
       INNER JOIN (${COMPLETE_SNAPSHOT_KEYS_SUBQUERY}) complete ON complete.snapshotKey = rs.snapshotKey
       WHERE rs.reportType = ?
       ORDER BY rs.snapshotTimestamp ASC
       LIMIT ?`, [reportType, limit]);
        return rows.map((row) => ({
            snapshotKey: row.snapshotKey,
            snapshotDate: row.snapshotDate,
            snapshotTimestamp: row.snapshotTimestamp,
            payloadJson: parseJsonField(row.payloadJson),
        }));
    }
    static async hasSnapshotForDate(snapshotDate) {
        const row = await queryOne(`SELECT COUNT(*) AS found
       FROM (
         SELECT snapshotKey
         FROM report_snapshots
         WHERE snapshotDate = ?
         GROUP BY snapshotKey
         HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ) complete`, [snapshotDate]);
        return (row?.found ?? 0) > 0;
    }
    static async getLatestSnapshotDate() {
        const row = await queryOne(`SELECT MAX(snapshotDate) AS snapshotDate
       FROM (
         SELECT snapshotDate, snapshotKey
         FROM report_snapshots
         GROUP BY snapshotKey, snapshotDate
         HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ) complete`);
        return row?.snapshotDate ?? null;
    }
    static async count() {
        const row = await queryOne('SELECT COUNT(*) AS total FROM report_snapshots');
        return row?.total ?? 0;
    }
    static async pruneOlderThan(retentionDays) {
        const cutoffSql = 'DATE_SUB(UTC_DATE(), INTERVAL ? DAY)';
        const snapshotResult = await execute(`DELETE FROM report_snapshots
       WHERE snapshotDate < ${cutoffSql}`, [retentionDays]);
        const metricsResult = await execute(`DELETE FROM snapshot_metrics
       WHERE snapshotDate < ${cutoffSql}`, [retentionDays]);
        const registryResult = await execute(`DELETE FROM snapshot_file_registry
       WHERE snapshotDate < ${cutoffSql}`, [retentionDays]);
        return {
            snapshots: (snapshotResult.affectedRows ?? 0) + (registryResult.affectedRows ?? 0),
            metrics: metricsResult.affectedRows ?? 0,
        };
    }
}
