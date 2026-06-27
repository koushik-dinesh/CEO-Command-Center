import type { ReportType } from '../reports/types.js';

export const REQUIRED_SNAPSHOT_REPORT_COUNT = 6;

export const REQUIRED_SNAPSHOT_REPORT_TYPES: ReportType[] = [
  'REVENUE_BY_SALESPERSON',
  'REVENUE_BY_CUSTOMER_GROUP',
  'REVENUE_BY_PRODUCT_GROUP',
  'REVENUE_VS_COGS',
  'INVENTORY_BY_WAREHOUSE',
  'DEAD_SLOW_MOVING_STOCK',
];

export function isCompleteReportCount(reportCount: number): boolean {
  return reportCount >= REQUIRED_SNAPSHOT_REPORT_COUNT;
}

export function isCompleteSnapshotBatch(reportTypes: ReportType[] | string[]): boolean {
  if (reportTypes.length < REQUIRED_SNAPSHOT_REPORT_COUNT) return false;
  const present = new Set(reportTypes);
  return REQUIRED_SNAPSHOT_REPORT_TYPES.every((type) => present.has(type));
}
