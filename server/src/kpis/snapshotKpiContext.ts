import { extractRevenuePeriods } from '../command-center/insights.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotMetricsRepository, type SnapshotMetricsRow } from '../repositories/SnapshotMetricsRepository.js';
import type {
  RevenueCustomerGroupPayload,
  RevenueProductGroupPayload,
  RevenueSalespersonPayload,
  RevenueVsCogsPayload,
} from '../reports/types.js';

export interface SnapshotKpiPayloads {
  revenueVsCogs: RevenueVsCogsPayload | null;
  customerGroup: RevenueCustomerGroupPayload | null;
  salesperson: RevenueSalespersonPayload | null;
  productGroup: RevenueProductGroupPayload | null;
}

export interface SnapshotKpiContext {
  metrics: SnapshotMetricsRow;
  payloads: SnapshotKpiPayloads;
}

function payloadsFromBatch(batch: Awaited<ReturnType<typeof ReportSnapshotRepository.getBatch>>): SnapshotKpiPayloads {
  const byType = new Map(batch.map((row) => [row.reportType, row.payloadJson]));
  return {
    revenueVsCogs: (byType.get('REVENUE_VS_COGS') as RevenueVsCogsPayload | undefined) ?? null,
    customerGroup: (byType.get('REVENUE_BY_CUSTOMER_GROUP') as RevenueCustomerGroupPayload | undefined) ?? null,
    salesperson: (byType.get('REVENUE_BY_SALESPERSON') as RevenueSalespersonPayload | undefined) ?? null,
    productGroup: (byType.get('REVENUE_BY_PRODUCT_GROUP') as RevenueProductGroupPayload | undefined) ?? null,
  };
}

export async function loadLatestSnapshotKpiContext(): Promise<SnapshotKpiContext | null> {
  const metrics = await SnapshotMetricsRepository.findLatestComplete();
  if (!metrics || metrics.revenue == null) return null;

  const batch = await ReportSnapshotRepository.getBatch(metrics.snapshotKey);
  return {
    metrics,
    payloads: payloadsFromBatch(batch),
  };
}

export function revenuePeriodsFromSnapshot(context: SnapshotKpiContext) {
  return extractRevenuePeriods({
    revenueVsCogs: context.payloads.revenueVsCogs,
    customerGroup: context.payloads.customerGroup,
    salesperson: context.payloads.salesperson,
    productGroup: context.payloads.productGroup,
  });
}
