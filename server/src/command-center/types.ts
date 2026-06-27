import type {
  DeadSlowStockPayload,
  InventoryWarehousePayload,
  ReportType,
  RevenueCustomerGroupPayload,
  RevenueProductGroupPayload,
  RevenueSalespersonPayload,
  RevenueVsCogsPayload,
  SnapshotBatch,
} from '../reports/types.js';

export type { CopqIntelligence } from './copqIntelligence.js';
export type { InventoryDaysIntelligence } from './inventoryDaysTypes.js';
export type { CopqSourceDebugPayload } from './copqSourceDebug.js';
import type { CopqIntelligence } from './copqIntelligence.js';
import type { InventoryDaysIntelligence } from './inventoryDaysTypes.js';
import type { ProductivityIntelligence } from '../productivity/ProductivityService.js';

export interface MetricTrendPoint {
  snapshotKey: string;
  snapshotDate: string;
  value: number;
}

export interface KpiSubMetric {
  key: string;
  label: string;
  value: number | null;
  unit: 'currency' | 'percent' | 'count' | 'days' | 'ratio';
  /** headline-tag = compact label under primary value; pill = secondary badge row */
  role?: 'headline-tag' | 'pill';
}

export interface RevenuePeriodMetrics {
  revenueYTD: number | null;
  revenueQTD: number | null;
  revenueMTD: number | null;
}

export interface KpiMetric {
  key: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  changePercent: number | null;
  changeAbsolute: number | null;
  trend: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  trendDirection: 'higher_is_better' | 'lower_is_better' | 'target_range';
  improvementDirection: 'higher' | 'lower';
  trendSentiment: 'positive' | 'negative' | 'neutral' | 'warning';
  trendLabel: string;
  chartSentiment: 'positive' | 'negative' | 'neutral' | 'warning';
  targetMinDays?: number;
  targetMaxDays?: number;
  statusTooltip?: string | null;
  unit: 'currency' | 'percent' | 'count' | 'days' | 'ratio';
  history: MetricTrendPoint[];
  health: 'good' | 'warning' | 'critical' | 'neutral';
  subMetrics?: KpiSubMetric[];
  /** Short context line for KPIs not tied to snapshot CSVs */
  footnote?: string | null;
  metadata?: Record<string, string | null>;
  drilldownPath?: string;
}

export interface ExecutiveInsight {
  id: string;
  category: 'revenue' | 'profitability' | 'inventory' | 'risk' | 'growth';
  severity: 'positive' | 'negative' | 'neutral' | 'warning';
  message: string;
}

export interface ComparisonMetric {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  trend: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  improvementDirection: 'higher' | 'lower';
  trendSentiment: 'positive' | 'negative' | 'neutral' | 'warning';
  trendLabel: string;
}

export interface CommandCenterFilters {
  salesperson?: string;
  customerGroup?: string;
  productGroup?: string;
  warehouse?: string;
}

export interface RevenueIntelligence {
  trend: MetricTrendPoint[];
  bySalesperson: Array<{ name: string; value: number; contributionPct: number }>;
  byCustomerGroup: Array<{ name: string; value: number; contributionPct: number }>;
  customerGroupInsights: CustomerGroupInsight[];
  byProductGroup: Array<{ name: string; value: number; contributionPct: number }>;
  topPerformers: Array<{ name: string; value: number; contributionPct: number; rank: number }>;
}

export interface ProfitabilityIntelligence {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  marginTrend: MetricTrendPoint[];
  byCategory: Array<{ type: string; revenue: number; cogs: number; marginPct: number }>;
}

export interface InventoryIntelligence {
  totalValue: number;
  trend: MetricTrendPoint[];
  byWarehouse: Array<{ name: string; value: number; contributionPct: number; skuCount: number }>;
  concentration: { topWarehouse: string; topSharePct: number };
}

export interface DeadStockIntelligence {
  deadStockValue: number;
  slowMovingValue: number;
  problemPct: number;
  trend: Array<{ snapshotKey: string; snapshotDate: string; dead: number; slow: number }>;
  topProblemItems: Array<{ itemNo: string; description: string; value: number; status: string; daysIdle: number }>;
  agingBuckets: Array<{ label: string; value: number; count: number }>;
}

export interface PbtIntelligence {
  revenue: number | null;
  directExpense: number | null;
  hrExpense: number | null;
  additionalIndirectExpense: number | null;
  indirectExpense: number | null;
  profitBeforeTax: number | null;
  trend: Array<{
    monthLabel: string;
    month: number;
    year: number;
    revenue: number | null;
    directExpense: number | null;
    hrExpense: number | null;
    additionalIndirectExpense: number | null;
    indirectExpense: number | null;
    profitBeforeTax: number | null;
  }>;
  records: Array<{
    id: string | null;
    month: number;
    year: number;
    monthLabel: string;
    revenue: number | null;
    directExpense: number | null;
    hrExpense: number | null;
    additionalIndirectExpense: number | null;
    indirectExpense: number | null;
    profitBeforeTax: number | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
}

export interface SnapshotAvailability {
  status: 'current' | 'stale';
  message: string | null;
  expectedDate: string;
  latestSnapshotDate: string;
}

export interface CustomerGroupInsight {
  name: string;
  value: number;
  contributionPct: number;
  rank: number;
  totalGroups: number;
  growthPct: number | null;
}

export interface CommandCenterResponse {
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: string;
  snapshotAvailability: SnapshotAvailability;
  previousSnapshotKey: string | null;
  availableSnapshots: SnapshotBatch[];
  kpis: KpiMetric[];
  revenuePeriods: RevenuePeriodMetrics;
  insights: ExecutiveInsight[];
  revenue: RevenueIntelligence;
  profitability: ProfitabilityIntelligence;
  inventory: InventoryIntelligence;
  deadStock: DeadStockIntelligence;
  pbt: PbtIntelligence;
  productivity: ProductivityIntelligence;
  copq: CopqIntelligence;
  inventoryDays: InventoryDaysIntelligence;
  summaries: {
    revenue: DrilldownSummary;
    profitability: DrilldownSummary;
    inventory: DrilldownSummary;
    inventoryDays: DrilldownSummary;
    deadStock: DrilldownSummary;
    pbt: DrilldownSummary;
    copq: DrilldownSummary;
    productivity: DrilldownSummary;
  };
  filters: {
    salespersons: string[];
    customerGroups: string[];
    productGroups: string[];
    warehouses: string[];
  };
  syncedAt: string;
  /** Temporary COPQ source inspection payload — remove after validation. */
  copqSourceDebug?: import('./copqSourceDebug.js').CopqSourceDebugPayload;
}

export interface DrilldownSummary {
  title: string;
  bullets: string[];
}

export interface ComparisonResponse {
  currentSnapshotKey: string;
  previousSnapshotKey: string;
  metrics: ComparisonMetric[];
}

export type SnapshotPayloadMap = {
  REVENUE_BY_SALESPERSON: RevenueSalespersonPayload;
  REVENUE_BY_CUSTOMER_GROUP: RevenueCustomerGroupPayload;
  REVENUE_BY_PRODUCT_GROUP: RevenueProductGroupPayload;
  REVENUE_VS_COGS: RevenueVsCogsPayload;
  INVENTORY_BY_WAREHOUSE: InventoryWarehousePayload;
  DEAD_SLOW_MOVING_STOCK: DeadSlowStockPayload;
};

export type { ReportType, SnapshotBatch };
