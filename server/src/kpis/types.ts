import type { KpiStatus } from '../db/types.js';
import type { Decimal } from 'decimal.js';
import type { SnapshotKpiContext } from './snapshotKpiContext.js';

export type KpiCode = 'REVENUE' | 'INVENTORY_VALUE' | 'COGS' | 'COPQ' | 'REVENUE_HR_COST_RATIO';

export interface KpiSourceRecord {
  sourceDate: Date;
  sourceKey?: string | null;
  normalized: Record<string, unknown>;
}

export interface KpiCalculationContext {
  recordsBySource: Map<string, KpiSourceRecord[]>;
  snapshotContext?: SnapshotKpiContext | null;
  copqHeadline?: Record<string, unknown> | null;
}

export interface KpiCalculationResult {
  value: Decimal | null;
  previousValue?: Decimal | null;
  status: KpiStatus;
  message?: string;
  metadataJson?: Record<string, unknown>;
}

export interface KpiCalculator {
  code: KpiCode;
  requiredSources: string[];
  calculate: (context: KpiCalculationContext) => KpiCalculationResult;
}
