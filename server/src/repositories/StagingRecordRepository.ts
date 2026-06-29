import type { RowDataPacket } from 'mysql2';
import type { DbExecutor } from '../db/mysql.js';
import { execute, queryRows } from '../db/mysql.js';
import { createId } from '../db/ids.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import type { StagingRecordWithSourceRow } from '../db/types.js';
import { SnapshotMetricsRepository } from './SnapshotMetricsRepository.js';

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

function mapRow(row: StagingRecordWithSourceDbRow): StagingRecordWithSourceRow {
  return { ...row, normalized: parseJsonField(row.normalized), raw: parseJsonField(row.raw) };
}

export class StagingRecordRepository {
  static async upsertMany(
    records: Array<{ dataSourceId: string; sourceDate: Date; sourceKey?: string; normalized: unknown; raw: unknown }>,
    executor?: DbExecutor,
  ): Promise<void> {
    if (records.length === 0) return;

    for (const record of records) {
      if (!record.sourceKey) {
        throw new Error('Staging upsert requires a non-empty sourceKey');
      }
      const id = createId('stage');
      await execute(
        `INSERT INTO staging_records (id, dataSourceId, sourceDate, sourceKey, normalized, raw)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           sourceDate = VALUES(sourceDate),
           normalized = VALUES(normalized),
           raw = VALUES(raw)`,
        [
          id,
          record.dataSourceId,
          record.sourceDate,
          record.sourceKey,
          stringifyJson(record.normalized),
          stringifyJson(record.raw),
        ],
        executor,
      );
    }
  }

  /** @deprecated Use upsertMany — retained for one-off scripts during migration. */
  static async createMany(
    records: Array<{ dataSourceId: string; sourceDate: Date; sourceKey?: string; normalized: unknown; raw: unknown }>,
    executor?: DbExecutor,
  ): Promise<void> {
    return StagingRecordRepository.upsertMany(records, executor);
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
    return SnapshotMetricsRepository.listDailyRevenueHistory(limit);
  }
}
