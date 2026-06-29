import type { RowDataPacket } from 'mysql2';
import type { DbExecutor } from '../db/mysql.js';
import { execute, queryRows, transaction } from '../db/mysql.js';
import type { NcCopqAnalyticsRecord } from '../copq/ncRecords.js';

interface NcCopqFactDbRow extends RowDataPacket {
  dataSourceId: string;
  sourceKey: string;
  ncNumber: string;
  ncDate: string;
  displayDate: string;
  product: string;
  department: string;
  rootCause: string;
  category: string;
  status: string;
  finalCopq: string;
  beforeQaCopq: string | null;
  syncedAt: Date;
}

function mapRow(row: NcCopqFactDbRow): NcCopqAnalyticsRecord {
  const ncDate = String(row.ncDate).slice(0, 10);
  return {
    sourceKey: row.sourceKey,
    ncNumber: row.ncNumber,
    ncDate,
    displayDate: row.displayDate,
    product: row.product,
    department: row.department,
    rootCause: row.rootCause,
    category: row.category,
    status: row.status,
    finalCopq: Number(row.finalCopq),
    beforeQaCopq: row.beforeQaCopq === null ? null : Number(row.beforeQaCopq),
  };
}

export class NcCopqFactRepository {
  static async countForDataSource(dataSourceId: string): Promise<number> {
    const rows = await queryRows<RowDataPacket & { count: number }>(
      'SELECT COUNT(*) AS count FROM nc_copq_facts WHERE dataSourceId = ?',
      [dataSourceId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  static async listForDataSource(dataSourceId: string): Promise<NcCopqAnalyticsRecord[]> {
    const rows = await queryRows<NcCopqFactDbRow>(
      `SELECT * FROM nc_copq_facts
       WHERE dataSourceId = ?
       ORDER BY finalCopq DESC, ncDate DESC`,
      [dataSourceId],
    );
    return rows.map(mapRow);
  }

  static async listPreview(dataSourceId: string, limit = 20): Promise<NcCopqAnalyticsRecord[]> {
    const rows = await queryRows<NcCopqFactDbRow>(
      `SELECT * FROM nc_copq_facts
       WHERE dataSourceId = ?
       ORDER BY finalCopq DESC
       LIMIT ?`,
      [dataSourceId, limit],
    );
    return rows.map(mapRow);
  }

  static async replaceAll(
    dataSourceId: string,
    records: NcCopqAnalyticsRecord[],
    syncedAt: Date,
    executor?: DbExecutor,
  ): Promise<void> {
    const persist = async (conn: DbExecutor) => {
      await execute('DELETE FROM nc_copq_facts WHERE dataSourceId = ?', [dataSourceId], conn);

      for (const record of records) {
        await execute(
          `INSERT INTO nc_copq_facts
           (dataSourceId, sourceKey, ncNumber, ncDate, displayDate, product, department,
            rootCause, category, status, finalCopq, beforeQaCopq, syncedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dataSourceId,
            record.sourceKey,
            record.ncNumber,
            record.ncDate,
            record.displayDate,
            record.product,
            record.department,
            record.rootCause,
            record.category,
            record.status,
            record.finalCopq,
            record.beforeQaCopq,
            syncedAt,
          ],
          conn,
        );
      }
    };

    if (executor) {
      await persist(executor);
      return;
    }

    await transaction((connection) => persist(connection));
  }
}
