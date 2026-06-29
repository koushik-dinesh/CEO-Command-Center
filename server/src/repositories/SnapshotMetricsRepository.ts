import type { RowDataPacket } from 'mysql2';
import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';
import { formatSnapshotDateFromDb, normalizeSnapshotDate, parseDateFromSnapshotKey } from '../snapshots/snapshotDate.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';

interface SnapshotMetricsDbRow extends RowDataPacket {
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: Date;
  revenue: string | null;
  grossProfit: string | null;
  grossMargin: string | null;
  ytdCogs: string | null;
  daysElapsed: number | null;
  inventoryDays: string | null;
  itr: string | null;
  inventoryValue: string | null;
  deadStock: string | null;
  slowMovingStock: string | null;
  reportCount: number;
  completeness: string;
  fileNames: unknown;
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SnapshotMetricsRow {
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: Date;
  revenue: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  ytdCogs: number | null;
  daysElapsed: number | null;
  inventoryDays: number | null;
  itr: number | null;
  inventoryValue: number | null;
  deadStock: number | null;
  slowMovingStock: number | null;
  reportCount: number;
  completeness: number;
  fileNames: string[];
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function toNumber(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRow(row: SnapshotMetricsDbRow): SnapshotMetricsRow {
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
    fileNames: parseJsonField<string[]>(row.fileNames) ?? [],
    computedAt: row.computedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SnapshotMetricsRepository {
  static async findByKey(snapshotKey: string): Promise<SnapshotMetricsRow | null> {
    const row = await queryOne<SnapshotMetricsDbRow>(
      `SELECT * FROM snapshot_metrics
       WHERE snapshotKey = ? AND reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       LIMIT 1`,
      [snapshotKey],
    );
    return row ? mapRow(row) : null;
  }

  static async findLatestComplete(): Promise<SnapshotMetricsRow | null> {
    const row = await queryOne<SnapshotMetricsDbRow>(
      `SELECT * FROM snapshot_metrics
       WHERE reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ORDER BY snapshotTimestamp DESC
       LIMIT 1`,
    );
    return row ? mapRow(row) : null;
  }

  static async upsert(data: {
    snapshotKey: string;
    snapshotDate: string;
    snapshotTimestamp: Date;
    revenue: number | null;
    grossProfit: number | null;
    grossMargin: number | null;
    ytdCogs: number | null;
    daysElapsed: number | null;
    inventoryDays: number | null;
    itr: number | null;
    inventoryValue: number | null;
    deadStock: number | null;
    slowMovingStock: number | null;
    reportCount: number;
    completeness: number;
    fileNames: string[];
    computedAt: Date;
  }): Promise<SnapshotMetricsRow> {
    await execute(
      `INSERT INTO snapshot_metrics
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
         updatedAt = CURRENT_TIMESTAMP(3)`,
      [
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
      ],
    );

    const row = await this.findByKey(data.snapshotKey);
    if (!row) throw new Error(`Snapshot metrics ${data.snapshotKey} not found after upsert`);
    return row;
  }

  static async listHistory(limit = 120): Promise<SnapshotMetricsRow[]> {
    const rows = await queryRows<SnapshotMetricsDbRow>(
      `SELECT * FROM snapshot_metrics
       WHERE reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ORDER BY snapshotTimestamp ASC
       LIMIT ?`,
      [limit],
    );
    return rows.map(mapRow);
  }

  /** Latest complete snapshot per calendar day — replaces analytics_daily_snapshots. */
  static async listDailyRevenueHistory(limit = 8): Promise<Array<{ calculatedAt: string; value: string }>> {
    const rows = await queryRows<SnapshotMetricsDbRow>(
      `SELECT sm.snapshotTimestamp, sm.revenue
       FROM snapshot_metrics sm
       INNER JOIN (
         SELECT snapshotDate, MAX(snapshotTimestamp) AS maxTimestamp
         FROM snapshot_metrics
         WHERE reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT} AND revenue IS NOT NULL
         GROUP BY snapshotDate
       ) latest ON sm.snapshotDate = latest.snapshotDate AND sm.snapshotTimestamp = latest.maxTimestamp
       WHERE sm.reportCount >= ${REQUIRED_SNAPSHOT_REPORT_COUNT}
       ORDER BY sm.snapshotDate ASC
       LIMIT ?`,
      [limit],
    );

    return rows.map((row) => ({
      calculatedAt: row.snapshotTimestamp.toISOString(),
      value: String(row.revenue ?? 0),
    }));
  }

  static async deleteByKey(snapshotKey: string): Promise<void> {
    await execute('DELETE FROM snapshot_metrics WHERE snapshotKey = ?', [snapshotKey]);
  }

  static async deleteIncomplete(): Promise<number> {
    const result = await execute(
      `DELETE FROM snapshot_metrics WHERE reportCount < ${REQUIRED_SNAPSHOT_REPORT_COUNT}`,
    );
    return result.affectedRows ?? 0;
  }

  static async deleteOlderThan(retentionDays: number): Promise<number> {
    const result = await execute(
      `DELETE FROM snapshot_metrics
       WHERE snapshotDate < DATE_SUB(UTC_DATE(), INTERVAL ? DAY)`,
      [retentionDays],
    );
    return result.affectedRows ?? 0;
  }

  static async count(): Promise<number> {
    const row = await queryOne<RowDataPacket & { total: number }>('SELECT COUNT(*) AS total FROM snapshot_metrics');
    return row?.total ?? 0;
  }

  static async listDistinctSnapshotKeys(): Promise<string[]> {
    const rows = await queryRows<RowDataPacket & { snapshotKey: string }>(
      'SELECT DISTINCT snapshotKey FROM report_snapshots ORDER BY snapshotKey',
    );
    return rows.map((row) => row.snapshotKey);
  }
}
