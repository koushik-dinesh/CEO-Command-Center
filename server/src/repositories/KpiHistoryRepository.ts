import type { RowDataPacket } from 'mysql2';
import type { KpiStatus, KpiValueRow, TrendDirection } from '../db/types.js';
import { createId } from '../db/ids.js';
import { stringifyJson, parseJsonField } from '../db/json.js';
import { execute, queryRows } from '../db/mysql.js';
import type { KpiCurrentRow } from './KpiCurrentRepository.js';

interface KpiHistoryDbRow extends RowDataPacket {
  id: string;
  kpiDefinitionId: string;
  kpiCode: string;
  periodStart: Date;
  periodEnd: Date;
  valueDecimal: string | null;
  previousValueDecimal: string | null;
  changePercent: string | null;
  trendDirection: TrendDirection;
  status: KpiStatus;
  sourceRunId: string | null;
  metadataJson: unknown | null;
  calculatedAt: Date;
  recordedAt: Date;
}

function mapHistoryRow(row: KpiHistoryDbRow): KpiValueRow {
  return {
    id: row.id,
    kpiDefinitionId: row.kpiDefinitionId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    valueDecimal: row.valueDecimal,
    previousValueDecimal: row.previousValueDecimal,
    changePercent: row.changePercent,
    trendDirection: row.trendDirection,
    status: row.status,
    sourceRunId: row.sourceRunId,
    metadataJson: row.metadataJson === null ? null : parseJsonField(row.metadataJson) as Record<string, unknown>,
    calculatedAt: row.calculatedAt,
    createdAt: row.recordedAt,
  };
}

export function mapKpiCurrentToValue(row: KpiCurrentRow): KpiValueRow {
  return {
    id: row.kpiDefinitionId,
    kpiDefinitionId: row.kpiDefinitionId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    valueDecimal: row.valueDecimal,
    previousValueDecimal: row.previousValueDecimal,
    changePercent: row.changePercent,
    trendDirection: row.trendDirection,
    status: row.status,
    sourceRunId: row.sourceRunId,
    metadataJson: row.metadataJson,
    calculatedAt: row.calculatedAt,
    createdAt: row.updatedAt,
  };
}

export class KpiHistoryRepository {
  static async append(kpiCode: string, value: KpiValueRow): Promise<void> {
    await execute(
      `INSERT INTO kpi_value_history
       (id, kpiDefinitionId, kpiCode, periodStart, periodEnd, valueDecimal, previousValueDecimal,
        changePercent, trendDirection, status, sourceRunId, metadataJson, calculatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId('khist'),
        value.kpiDefinitionId,
        kpiCode,
        value.periodStart,
        value.periodEnd,
        value.valueDecimal,
        value.previousValueDecimal,
        value.changePercent,
        value.trendDirection,
        value.status,
        value.sourceRunId,
        value.metadataJson ? stringifyJson(value.metadataJson) : null,
        value.calculatedAt,
      ],
    );
  }

  static async listForDefinition(kpiDefinitionId: string, limit = 8): Promise<KpiValueRow[]> {
    const rows = await queryRows<KpiHistoryDbRow>(
      `SELECT * FROM kpi_value_history
       WHERE kpiDefinitionId = ? AND valueDecimal IS NOT NULL
       ORDER BY calculatedAt DESC
       LIMIT ?`,
      [kpiDefinitionId, limit],
    );
    return rows.map(mapHistoryRow);
  }

  static async pruneOlderThan(retentionDays: number): Promise<number> {
    const result = await execute(
      'DELETE FROM kpi_value_history WHERE calculatedAt < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? DAY)',
      [retentionDays],
    );
    return result.affectedRows ?? 0;
  }

  static async pruneExcessPerKpi(maxRowsPerKpi: number): Promise<number> {
    const result = await execute(
      `DELETE kh FROM kpi_value_history kh
       INNER JOIN (
         SELECT id FROM (
           SELECT id,
             ROW_NUMBER() OVER (PARTITION BY kpiDefinitionId ORDER BY calculatedAt DESC) AS rowNum
           FROM kpi_value_history
         ) ranked
         WHERE rowNum > ?
       ) excess ON excess.id = kh.id`,
      [maxRowsPerKpi],
    );
    return result.affectedRows ?? 0;
  }
}
