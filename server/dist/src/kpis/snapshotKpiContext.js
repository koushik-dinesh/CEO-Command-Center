import { extractRevenuePeriods } from '../command-center/insights.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotMetricsRepository } from '../repositories/SnapshotMetricsRepository.js';
function payloadsFromBatch(batch) {
    const byType = new Map(batch.map((row) => [row.reportType, row.payloadJson]));
    return {
        revenueVsCogs: byType.get('REVENUE_VS_COGS') ?? null,
        customerGroup: byType.get('REVENUE_BY_CUSTOMER_GROUP') ?? null,
        salesperson: byType.get('REVENUE_BY_SALESPERSON') ?? null,
        productGroup: byType.get('REVENUE_BY_PRODUCT_GROUP') ?? null,
    };
}
export async function loadLatestSnapshotKpiContext() {
    const metrics = await SnapshotMetricsRepository.findLatestComplete();
    if (!metrics || metrics.revenue == null)
        return null;
    const batch = await ReportSnapshotRepository.getBatch(metrics.snapshotKey);
    return {
        metrics,
        payloads: payloadsFromBatch(batch),
    };
}
export function revenuePeriodsFromSnapshot(context) {
    return extractRevenuePeriods({
        revenueVsCogs: context.payloads.revenueVsCogs,
        customerGroup: context.payloads.customerGroup,
        salesperson: context.payloads.salesperson,
        productGroup: context.payloads.productGroup,
    });
}
