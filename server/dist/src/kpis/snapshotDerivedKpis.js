import { KpiCalculationService } from './KpiCalculationService.js';
export const SNAPSHOT_DERIVED_KPI_CODES = [
    'REVENUE',
    'INVENTORY_VALUE',
    'COGS',
    'REVENUE_HR_COST_RATIO',
];
export async function recalcSnapshotDerivedKpis(sourceRunId) {
    await new KpiCalculationService().calculateAndPersist({
        sourceRunId,
        codes: SNAPSHOT_DERIVED_KPI_CODES,
    });
}
