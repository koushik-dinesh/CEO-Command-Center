import { processDeadSlowStock } from './processors/dead-slow-stock.js';
import { processInventoryWarehouse } from './processors/inventory-warehouse.js';
import { processRevenueCustomerGroup } from './processors/revenue-customer-group.js';
import { processRevenueProductGroup } from './processors/revenue-product-group.js';
import { processRevenueSalesperson } from './processors/revenue-salesperson.js';
import { processRevenueVsCogs } from './processors/revenue-vs-cogs.js';
import { REPORT_FILENAME_PATTERNS } from './filename-parser.js';
import type { ParsedFilename, ReportPayload, ReportProcessor, ReportType } from './types.js';

const processors: ReportProcessor<ReportPayload>[] = [
  { type: 'REVENUE_BY_SALESPERSON', pattern: REPORT_FILENAME_PATTERNS[0].pattern, process: processRevenueSalesperson },
  { type: 'REVENUE_BY_CUSTOMER_GROUP', pattern: REPORT_FILENAME_PATTERNS[1].pattern, process: processRevenueCustomerGroup },
  { type: 'REVENUE_BY_PRODUCT_GROUP', pattern: REPORT_FILENAME_PATTERNS[2].pattern, process: processRevenueProductGroup },
  { type: 'REVENUE_VS_COGS', pattern: REPORT_FILENAME_PATTERNS[3].pattern, process: processRevenueVsCogs },
  { type: 'INVENTORY_BY_WAREHOUSE', pattern: REPORT_FILENAME_PATTERNS[4].pattern, process: processInventoryWarehouse },
  { type: 'DEAD_SLOW_MOVING_STOCK', pattern: REPORT_FILENAME_PATTERNS[5].pattern, process: processDeadSlowStock },
];

export function getProcessor(type: ReportType): ReportProcessor<ReportPayload> {
  const processor = processors.find((entry) => entry.type === type);
  if (!processor) throw new Error(`No processor registered for ${type}`);
  return processor;
}

export function processReport(content: string, meta: ParsedFilename): ReportPayload {
  return getProcessor(meta.reportType).process(content, meta);
}

export function allReportTypes(): ReportType[] {
  return processors.map((entry) => entry.type);
}

export const REPORT_REGISTRY = processors;
