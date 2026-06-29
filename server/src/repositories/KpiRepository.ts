import type { KpiStatus, KpiValueRow, TrendDirection } from '../db/types.js';
import { createId } from '../db/ids.js';
import { parseJsonField } from '../db/json.js';
import { queryOne, queryRows } from '../db/mysql.js';
import type { KpiDefinitionRow } from '../db/types.js';
import type { RowDataPacket } from 'mysql2';
import { AnalyticsStorageService } from '../analytics/AnalyticsStorageService.js';
import { KpiCurrentRepository } from './KpiCurrentRepository.js';
import { KpiHistoryRepository, mapKpiCurrentToValue } from './KpiHistoryRepository.js';

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

function mapDefinition(row: KpiDefinitionDbRow): KpiDefinitionRow {
  return { ...row, isActive: Boolean(row.isActive), configJson: row.configJson === null ? null : parseJsonField(row.configJson) };
}

export class KpiRepository {
  static async activeDefinitions(): Promise<KpiDefinitionRow[]> {
    const rows = await queryRows<KpiDefinitionDbRow>('SELECT * FROM kpi_definitions WHERE isActive = 1 ORDER BY sortOrder ASC');
    return rows.map(mapDefinition);
  }

  static async latestValue(kpiDefinitionId: string): Promise<KpiValueRow | null> {
    const current = await KpiCurrentRepository.findByDefinitionId(kpiDefinitionId);
    return current ? mapKpiCurrentToValue(current) : null;
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
    return KpiHistoryRepository.listForDefinition(kpiDefinitionId, limit);
  }

  static async persistKpi(kpiCode: string, data: {
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
    const calculatedAt = new Date();
    const value: KpiValueRow = {
      id: createId('kcur'),
      kpiDefinitionId: data.kpiDefinitionId,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      valueDecimal: data.valueDecimal,
      previousValueDecimal: data.previousValueDecimal,
      changePercent: data.changePercent,
      trendDirection: data.trendDirection,
      status: data.status,
      sourceRunId: data.sourceRunId ?? null,
      metadataJson: data.metadataJson ?? null,
      calculatedAt,
      createdAt: calculatedAt,
    };

    await AnalyticsStorageService.persistKpi(kpiCode, value);
    return value;
  }
}
