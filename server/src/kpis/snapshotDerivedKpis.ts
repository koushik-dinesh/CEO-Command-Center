import { KpiCalculationService } from './KpiCalculationService.js';
import type { KpiCode } from './types.js';

export const SNAPSHOT_DERIVED_KPI_CODES: KpiCode[] = [
  'REVENUE',
  'INVENTORY_VALUE',
  'COGS',
  'REVENUE_HR_COST_RATIO',
];

export async function recalcSnapshotDerivedKpis(sourceRunId?: string): Promise<void> {
  await new KpiCalculationService().calculateAndPersist({
    sourceRunId,
    codes: SNAPSHOT_DERIVED_KPI_CODES,
  });
}
