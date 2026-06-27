import type { RowDataPacket } from 'mysql2';
import { formatSnapshotDateFromDb, normalizeSnapshotDate, parseDateFromSnapshotKey } from '../snapshots/snapshotDate.js';
import { createId } from '../db/ids.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
import type { ReportPayload, ReportType, SnapshotBatch } from '../reports/types.js';
import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';

const COMPLETE_SNAPSHOT_KEYS_SUBQUERY = `
  SELECT snapshotKey
  FROM report_snapshots
  GROUP BY snapshotKey
  HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
`;

interface ReportSnapshotDbRow extends RowDataPacket {
  id: string;
  reportType: ReportType;
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: Date;
  providerFileId: string;
  fileName: string;
  checksum: string;
  payloadJson: unknown;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportSnapshotRow {
  id: string;
  reportType: ReportType;
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: Date;
  providerFileId: string;
  fileName: string;
  checksum: string;
  payloadJson: ReportPayload;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: ReportSnapshotDbRow): ReportSnapshotRow {
  const snapshotDate = normalizeSnapshotDate(row.snapshotDate)
    ?? parseDateFromSnapshotKey(row.snapshotKey)
    ?? formatSnapshotDateFromDb(row.snapshotDate);
  return {
    ...row,
    snapshotDate,
    payloadJson: parseJsonField<ReportPayload>(row.payloadJson),
  };
}

export class ReportSnapshotRepository {
  static async findByChecksum(reportType: ReportType, checksum: string): Promise<ReportSnapshotRow | null> {
    const row = await queryOne<ReportSnapshotDbRow>(
      'SELECT * FROM report_snapshots WHERE reportType = ? AND checksum = ? LIMIT 1',
      [reportType, checksum],
    );
    return row ? mapRow(row) : null;
  }

  static async upsert(data: {
    reportType: ReportType;
    snapshotKey: string;
    snapshotDate: string;
    snapshotTimestamp: Date;
    providerFileId: string;
    fileName: string;
    checksum: string;
    payloadJson: ReportPayload;
  }): Promise<ReportSnapshotRow> {
    const id = createId('snap');
    const processedAt = new Date();
    await execute(
      `INSERT INTO report_snapshots
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
         updatedAt = CURRENT_TIMESTAMP(3)`,
      [
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
      ],
    );

    const row = await queryOne<ReportSnapshotDbRow>(
      'SELECT * FROM report_snapshots WHERE reportType = ? AND providerFileId = ? LIMIT 1',
      [data.reportType, data.providerFileId],
    );
    if (!row) throw new Error(`Snapshot not found after upsert for ${data.fileName}`);
    return mapRow(row);
  }

  static async listBatches(limit = 200): Promise<SnapshotBatch[]> {
    const rows = await queryRows<RowDataPacket & { snapshotKey: string; snapshotDate: string; snapshotTimestamp: Date; reportTypes: string; reportCount: number }>(
      `SELECT snapshotKey, snapshotDate, MAX(snapshotTimestamp) AS snapshotTimestamp,
              GROUP_CONCAT(DISTINCT reportType ORDER BY reportType) AS reportTypes,
              COUNT(DISTINCT reportType) AS reportCount
       FROM report_snapshots
       GROUP BY snapshotKey, snapshotDate
       HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ORDER BY snapshotTimestamp DESC
       LIMIT ?`,
      [limit],
    );

    return rows.map((row) => ({
      snapshotKey: row.snapshotKey,
      snapshotDate: row.snapshotDate,
      snapshotTimestamp: row.snapshotTimestamp.toISOString(),
      reportTypes: row.reportTypes.split(',') as ReportType[],
      completeness: Number(row.reportCount) / REQUIRED_SNAPSHOT_REPORT_COUNT,
    }));
  }

  static async getBatch(snapshotKey: string): Promise<ReportSnapshotRow[]> {
    const rows = await queryRows<ReportSnapshotDbRow>(
      `SELECT id, reportType, snapshotKey, snapshotDate, snapshotTimestamp, providerFileId, fileName, checksum, payloadJson, processedAt, createdAt, updatedAt
       FROM report_snapshots WHERE snapshotKey = ? ORDER BY reportType`,
      [snapshotKey],
    );
    return rows.map(mapRow);
  }

  static async getLatestBatch(): Promise<ReportSnapshotRow[]> {
    const latest = await queryOne<RowDataPacket & { snapshotKey: string }>(
      `SELECT snapshotKey FROM report_snapshots
       WHERE snapshotKey IN (${COMPLETE_SNAPSHOT_KEYS_SUBQUERY})
       ORDER BY snapshotTimestamp DESC LIMIT 1`,
    );
    if (!latest) return [];
    return this.getBatch(latest.snapshotKey);
  }

  static async isCompleteSnapshotKey(snapshotKey: string): Promise<boolean> {
    const row = await queryOne<RowDataPacket & { reportCount: number }>(
      'SELECT COUNT(DISTINCT reportType) AS reportCount FROM report_snapshots WHERE snapshotKey = ?',
      [snapshotKey],
    );
    return (row?.reportCount ?? 0) >= REQUIRED_SNAPSHOT_REPORT_COUNT;
  }

  static async historyForType(reportType: ReportType, limit = 120): Promise<Array<Pick<ReportSnapshotRow, 'snapshotKey' | 'snapshotDate' | 'snapshotTimestamp' | 'payloadJson'>>> {
    const rows = await queryRows<RowDataPacket & { snapshotKey: string; snapshotDate: string; snapshotTimestamp: Date; payloadJson: unknown }>(
      `SELECT rs.snapshotKey, rs.snapshotDate, rs.snapshotTimestamp, rs.payloadJson
       FROM report_snapshots rs
       INNER JOIN (${COMPLETE_SNAPSHOT_KEYS_SUBQUERY}) complete ON complete.snapshotKey = rs.snapshotKey
       WHERE rs.reportType = ?
       ORDER BY rs.snapshotTimestamp ASC
       LIMIT ?`,
      [reportType, limit],
    );
    return rows.map((row) => ({
      snapshotKey: row.snapshotKey,
      snapshotDate: row.snapshotDate,
      snapshotTimestamp: row.snapshotTimestamp,
      payloadJson: parseJsonField<ReportPayload>(row.payloadJson),
    }));
  }

  static async hasSnapshotForDate(snapshotDate: string): Promise<boolean> {
    const row = await queryOne<RowDataPacket & { found: number }>(
      `SELECT COUNT(*) AS found
       FROM (
         SELECT snapshotKey
         FROM report_snapshots
         WHERE snapshotDate = ?
         GROUP BY snapshotKey
         HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ) complete`,
      [snapshotDate],
    );
    return (row?.found ?? 0) > 0;
  }

  static async getLatestSnapshotDate(): Promise<string | null> {
    const row = await queryOne<RowDataPacket & { snapshotDate: string }>(
      `SELECT MAX(snapshotDate) AS snapshotDate
       FROM (
         SELECT snapshotDate, snapshotKey
         FROM report_snapshots
         GROUP BY snapshotKey, snapshotDate
         HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ) complete`,
    );
    return row?.snapshotDate ?? null;
  }

  static async count(): Promise<number> {
    const row = await queryOne<RowDataPacket & { total: number }>('SELECT COUNT(*) AS total FROM report_snapshots');
    return row?.total ?? 0;
  }
}
