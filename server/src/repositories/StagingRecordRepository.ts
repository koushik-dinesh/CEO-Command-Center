import type { RowDataPacket } from 'mysql2';
import type { DbExecutor } from '../db/mysql.js';
import { execute, queryRows } from '../db/mysql.js';
import { createId } from '../db/ids.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import type { StagingRecordWithSourceRow } from '../db/types.js';

interface StagingRecordWithSourceDbRow extends RowDataPacket {
  id: string;
  dataSourceId: string;
  sourceDate: Date;
  sourceKey: string | null;
  normalized: unknown;
  raw: unknown;
  createdAt: Date;
  dataSourceCode: string;
}

interface RevenueSnapshotDbRow extends RowDataPacket {
  sourceDate: Date;
  sourceFileName: string | null;
  valueDecimal: string | null;
}

function mapRow(row: StagingRecordWithSourceDbRow): StagingRecordWithSourceRow {
  return { ...row, normalized: parseJsonField(row.normalized), raw: parseJsonField(row.raw) };
}

export class StagingRecordRepository {
  static async createMany(records: Array<{ dataSourceId: string; sourceDate: Date; sourceKey?: string; normalized: unknown; raw: unknown }>, executor?: DbExecutor): Promise<void> {
    if (records.length === 0) return;
    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const params = records.flatMap((record) => [
      createId('stage'),
      record.dataSourceId,
      record.sourceDate,
      record.sourceKey ?? null,
      stringifyJson(record.normalized),
      stringifyJson(record.raw),
    ]);
    await execute(
      `INSERT INTO staging_records (id, dataSourceId, sourceDate, sourceKey, normalized, raw) VALUES ${placeholders}`,
      params,
      executor,
    );
  }

  static async findForPeriod(periodStart: Date, periodEnd: Date): Promise<StagingRecordWithSourceRow[]> {
    const rows = await queryRows<StagingRecordWithSourceDbRow>(
      `SELECT sr.*, ds.code AS dataSourceCode
       FROM staging_records sr
       INNER JOIN data_sources ds ON ds.id = sr.dataSourceId
       WHERE sr.sourceDate >= ? AND sr.sourceDate <= ?`,
      [periodStart, periodEnd],
    );
    return rows.map(mapRow);
  }

  static async revenueSnapshots(limit = 8): Promise<Array<{ calculatedAt: string; value: string }>> {
    const rows = await queryRows<RevenueSnapshotDbRow>(
      `SELECT *
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
       ORDER BY sourceDate ASC`,
      [limit],
    );

    return rows
      .filter((row) => row.valueDecimal !== null)
      .map((row) => ({ calculatedAt: row.sourceDate.toISOString(), value: String(row.valueDecimal) }));
  }
}
