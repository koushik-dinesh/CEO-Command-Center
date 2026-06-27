import type { ParsedFilename, ReportType } from './types.js';

const snapshotSuffixPattern = /_(\d{8})_(\d{4,6})\.csv$/i;

export const REPORT_FILENAME_PATTERNS: Array<{ type: ReportType; pattern: RegExp }> = [
  { type: 'REVENUE_BY_SALESPERSON', pattern: /^Sales_Revenue_by_Salesperson_/i },
  { type: 'REVENUE_BY_CUSTOMER_GROUP', pattern: /^Sales_Revenue_by_Customer_Group_/i },
  { type: 'REVENUE_BY_PRODUCT_GROUP', pattern: /^ProductWise_Revenue_by_Item_Group_/i },
  { type: 'REVENUE_VS_COGS', pattern: /^View_Revenue_vs_COGS_Fiscal_/i },
  { type: 'INVENTORY_BY_WAREHOUSE', pattern: /^Dashboard_InventoryDashBoard-Total_Stock_Based_on_Warehouses_/i },
  { type: 'DEAD_SLOW_MOVING_STOCK', pattern: /^Dashboard_Inventory-Dead_and_Slow_Moving_Stock_/i },
];

export function detectReportType(fileName: string): ReportType | null {
  const match = REPORT_FILENAME_PATTERNS.find((entry) => entry.pattern.test(fileName));
  return match?.type ?? null;
}

export function parseSnapshotFilename(fileName: string): ParsedFilename | null {
  const reportType = detectReportType(fileName);
  if (!reportType) return null;

  const suffix = snapshotSuffixPattern.exec(fileName);
  if (!suffix) return null;

  const [, datePart, timePart] = suffix;
  const normalizedTime = timePart.padEnd(6, '0');
  const snapshotDate = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  const snapshotTimestamp = `${snapshotDate}T${normalizedTime.slice(0, 2)}:${normalizedTime.slice(2, 4)}:${normalizedTime.slice(4, 6)}.000Z`;

  return {
    reportType,
    snapshotKey: `${datePart}_${normalizedTime}`,
    snapshotDate,
    snapshotTimestamp,
    fileName,
  };
}
