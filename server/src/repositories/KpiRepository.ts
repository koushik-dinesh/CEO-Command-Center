import type { RowDataPacket } from 'mysql2';
import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
import { parseJsonField } from '../db/json.js';
import type { KpiDefinitionRow, KpiStatus, KpiValueRow, TrendDirection } from '../db/types.js';

interface KpiDefinitionDbRow extends RowDataPacket {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  displayFormat: string;
  calculationType: string;
  sortOrder: number;
  isActive: number;
  configJson: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

interface KpiValueDbRow extends RowDataPacket {
  id: string;
  kpiDefinitionId: string;
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
  createdAt: Date;
}

function mapDefinition(row: KpiDefinitionDbRow): KpiDefinitionRow {
  return { ...row, isActive: Boolean(row.isActive), configJson: row.configJson === null ? null : parseJsonField(row.configJson) };
}

function mapKpiValue(row: KpiValueDbRow | null): KpiValueRow | null {
  if (!row) return null;
  return { ...row, metadataJson: row.metadataJson === null ? null : parseJsonField(row.metadataJson) };
}

export class KpiRepository {
  static async activeDefinitions(): Promise<KpiDefinitionRow[]> {
    const rows = await queryRows<KpiDefinitionDbRow>('SELECT * FROM kpi_definitions WHERE isActive = 1 ORDER BY sortOrder ASC');
    return rows.map(mapDefinition);
  }

  static async latestValue(kpiDefinitionId: string): Promise<KpiValueRow | null> {
    const row = await queryOne<KpiValueDbRow>(
      'SELECT * FROM kpi_values WHERE kpiDefinitionId = ? ORDER BY calculatedAt DESC LIMIT 1',
      [kpiDefinitionId],
    );
    return mapKpiValue(row);
  }

  static async findDefinitionByCode(code: string): Promise<KpiDefinitionRow | null> {
    const row = await queryOne<KpiDefinitionDbRow>(
      'SELECT * FROM kpi_definitions WHERE code = ? AND isActive = 1 LIMIT 1',
      [code],
    );
    return row ? mapDefinition(row) : null;
  }

  static async latestValueByCode(code: string): Promise<{ definition: KpiDefinitionRow; value: KpiValueRow } | null> {
    const definition = await this.findDefinitionByCode(code);
    if (!definition) return null;
    const value = await this.latestValue(definition.id);
    if (!value) return null;
    return { definition, value };
  }

  static async history(kpiDefinitionId: string, limit = 8): Promise<KpiValueRow[]> {
    const rows = await queryRows<KpiValueDbRow>(
      'SELECT * FROM kpi_values WHERE kpiDefinitionId = ? AND valueDecimal IS NOT NULL ORDER BY calculatedAt DESC LIMIT ?',
      [kpiDefinitionId, limit],
    );
    return rows.map((row) => mapKpiValue(row)!);
  }

  static async createValue(data: {
    kpiDefinitionId: string;
    periodStart: Date;
    periodEnd: Date;
    valueDecimal: string | null;
    previousValueDecimal: string | null;
    changePercent: string | null;
    trendDirection: TrendDirection;
    status: KpiStatus;
    sourceRunId?: string;
    metadataJson?: Record<string, unknown>;
  }): Promise<KpiValueRow> {
    const id = createId('kval');
    const calculatedAt = new Date();
    await execute(
      `INSERT INTO kpi_values
       (id, kpiDefinitionId, periodStart, periodEnd, valueDecimal, previousValueDecimal, changePercent, trendDirection, status, sourceRunId, metadataJson, calculatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.kpiDefinitionId,
        data.periodStart,
        data.periodEnd,
        data.valueDecimal,
        data.previousValueDecimal,
        data.changePercent,
        data.trendDirection,
        data.status,
        data.sourceRunId ?? null,
        data.metadataJson ? JSON.stringify(data.metadataJson) : null,
        calculatedAt,
      ],
    );
    const created = await queryOne<KpiValueDbRow>('SELECT * FROM kpi_values WHERE id = ? LIMIT 1', [id]);
    const mapped = mapKpiValue(created);
    if (!mapped) throw new Error(`KPI value ${id} not found after insert`);
    return mapped;
  }
}
