import type { RowDataPacket } from 'mysql2';
import type { DbExecutor } from '../db/mysql.js';
import { execute, queryOne } from '../db/mysql.js';
import { parseJsonField, stringifyJson } from '../db/json.js';

export interface CopqAnalyticsMetaRow {
  dataSourceId: string;
  referenceDate: string;
  financialYearStart: string;
  monthStart: string;
  quarterStart: string;
  sheetName: string | null;
  sourceWorkbook: string | null;
  lastUpdated: string | null;
  recordCount: number;
  rejectedRowCount: number;
  dateColumnUsed: string | null;
  copqColumnUsed: string | null;
  headlineJson: Record<string, unknown> | null;
  syncedAt: Date;
  updatedAt: Date;
}

interface CopqAnalyticsMetaDbRow extends RowDataPacket {
  dataSourceId: string;
  referenceDate: string;
  financialYearStart: string;
  monthStart: string;
  quarterStart: string;
  sheetName: string | null;
  sourceWorkbook: string | null;
  lastUpdated: string | null;
  recordCount: number;
  rejectedRowCount: number;
  dateColumnUsed: string | null;
  copqColumnUsed: string | null;
  headlineJson: unknown | null;
  syncedAt: Date;
  updatedAt: Date;
}

function mapRow(row: CopqAnalyticsMetaDbRow): CopqAnalyticsMetaRow {
  return {
    ...row,
    referenceDate: String(row.referenceDate).slice(0, 10),
    financialYearStart: String(row.financialYearStart).slice(0, 10),
    monthStart: String(row.monthStart).slice(0, 10),
    quarterStart: String(row.quarterStart).slice(0, 10),
    headlineJson: row.headlineJson === null ? null : parseJsonField(row.headlineJson) as Record<string, unknown>,
  };
}

export class CopqAnalyticsMetaRepository {
  static async findByDataSourceId(dataSourceId: string): Promise<CopqAnalyticsMetaRow | null> {
    const row = await queryOne<CopqAnalyticsMetaDbRow>(
      'SELECT * FROM copq_analytics_meta WHERE dataSourceId = ? LIMIT 1',
      [dataSourceId],
    );
    return row ? mapRow(row) : null;
  }

  static async upsert(
    data: Omit<CopqAnalyticsMetaRow, 'updatedAt'>,
    executor?: DbExecutor,
  ): Promise<void> {
    await execute(
      `INSERT INTO copq_analytics_meta
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
         updatedAt = CURRENT_TIMESTAMP(3)`,
      [
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
      ],
      executor,
    );
  }
}
