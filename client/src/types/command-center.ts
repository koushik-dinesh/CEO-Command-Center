import type { ProductivityIntelligence } from './productivity';

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

export interface SnapshotBatch {
  snapshotKey: string;
  snapshotDate: string;
  snapshotTimestamp: string;
  reportTypes: string[];
  completeness: number;
}

export interface SyncHistoryFile {
  name: string;
  status: 'success' | 'failed';
  fetchedAt: string;
  error?: string;
}

export interface SyncHistorySession {
  id: string;
  source: 'DRIVE' | 'SHEETS';
  syncType: 'MANUAL' | 'AUTOMATIC';
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  startedAt: string;
  completedAt: string;
  totalFilesProcessed: number;
  durationMs: number;
  files: SyncHistoryFile[];
}

export interface SyncHistorySnapshot {
  sessions: SyncHistorySession[];
}

export interface DrilldownSummary {
  title: string;
  bullets: string[];
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
  trendSentiment: 'positive' | 'negative' | 'neutral';
  trendLabel: string;
}

export interface ComparisonResponse {
  currentSnapshotKey: string;
  previousSnapshotKey: string;
  metrics: ComparisonMetric[];
}

export interface CommandCenterFilters {
  salesperson?: string;
  customerGroup?: string;
  productGroup?: string;
  warehouse?: string;
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
  revenue: {
    trend: MetricTrendPoint[];
    bySalesperson: Array<{ name: string; value: number; contributionPct: number }>;
    byCustomerGroup: Array<{ name: string; value: number; contributionPct: number }>;
    customerGroupInsights: CustomerGroupInsight[];
    byProductGroup: Array<{ name: string; value: number; contributionPct: number }>;
    topPerformers: Array<{ name: string; value: number; contributionPct: number; rank: number }>;
  };
  profitability: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    marginTrend: MetricTrendPoint[];
    byCategory: Array<{ type: string; revenue: number; cogs: number; marginPct: number }>;
  };
  inventory: {
    totalValue: number;
    trend: MetricTrendPoint[];
    byWarehouse: Array<{ name: string; value: number; contributionPct: number; skuCount: number }>;
    concentration: { topWarehouse: string; topSharePct: number };
  };
  deadStock: {
    deadStockValue: number;
    slowMovingValue: number;
    problemPct: number;
    trend: Array<{ snapshotKey: string; snapshotDate: string; dead: number; slow: number }>;
    topProblemItems: Array<{ itemNo: string; description: string; value: number; status: string; daysIdle: number }>;
    agingBuckets: Array<{ label: string; value: number; count: number }>;
  };
  pbt: {
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
  };
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
  inventoryDays: {
    summary: {
      currentInventoryValue: number | null;
      ytdCogs: number | null;
      daysElapsed: number | null;
      inventoryDays: number | null;
      snapshotDate: string;
      financialYearStart: string;
      statusMessage: string | null;
      targetMinDays: number;
      targetMaxDays: number;
      health: 'good' | 'warning' | 'critical' | 'neutral';
      statusTooltip: string | null;
    };
    formula: {
      expression: string;
      inventory: number | null;
      daysElapsed: number | null;
      ytdCogs: number | null;
      inventoryDays: number | null;
    };
    trend: MetricTrendPoint[];
    insights: Array<{
      id: string;
      severity: 'positive' | 'negative' | 'neutral' | 'warning';
      message: string;
    }>;
    dataSources: Array<{
      key: string;
      name: string;
      purpose: string;
      refreshDate: string;
      fileName: string | null;
    }>;
    methodology: string;
  };
  copq: {
    summary: {
      totalCopqYtd: number | null;
      copqMtd: number | null;
      copqQtd: number | null;
      qaSavedAmount: number | null;
      beforeQaClearance: number | null;
    };
    categoryBreakdown: Array<{
      category: string;
      mtd: number;
      qtd: number;
      ytd: number;
      pctOfTotal: number;
    }>;
    topContributors: Array<{
      ncNumber: string;
      date: string;
      product: string;
      department: string;
      rootCause: string;
      finalCopq: number;
      status: string;
    }>;
    byDepartment: Array<{
      department: string;
      ncCount: number;
      totalCopq: number;
      avgCopq: number;
      pctContribution: number;
    }>;
    byProduct: Array<{
      product: string;
      ncCount: number;
      totalCopq: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      monthLabel: string;
      copq: number;
      qaSaved: number | null;
      beforeQaClearance: number | null;
    }>;
    sourceInfo: {
      sourceWorkbook: string | null;
      sheetName: string | null;
      lastUpdated: string | null;
      refreshTime: string | null;
    };
    insights: Array<{ id: string; severity: 'positive' | 'negative' | 'neutral' | 'warning'; message: string }>;
  };
  filters: {
    salespersons: string[];
    customerGroups: string[];
    productGroups: string[];
    warehouses: string[];
  };
  syncedAt: string;
  syncHistory: SyncHistorySnapshot;
  productivity: ProductivityIntelligence;
  /** Temporary COPQ source inspection payload — remove after validation. */
  copqSourceDebug?: CopqSourceDebugPayload;
}

export interface CopqSourceDebugCell {
  ref: string;
  raw: unknown;
  formatted: string | null;
  parsed: string | null;
  formula: string | null;
}

export interface CopqSourceDebugDataset {
  sourceName: string;
  fileName: string;
  sheetName: string | null;
  range: string | null;
  headers: string[];
  rowsPreview: unknown[][];
  rowCount: number;
  cells?: Record<string, CopqSourceDebugCell>;
}

export interface CopqSourceDebugMapping {
  label: string;
  sheet: string;
  cell?: string;
  column?: string;
  dateColumn?: string;
  filter?: string;
  rowCount?: number;
  sourceKeys?: string[];
  rawValue: unknown;
  parsedValue: string | null;
  notes?: string;
}

export interface CopqSourceDebugPayload {
  generatedAt: string;
  dataSource: {
    code: string;
    name: string;
    locationRef: string;
    configJson: unknown;
  } | null;
  datasets: CopqSourceDebugDataset[];
  mappings: {
    copqYtd: CopqSourceDebugMapping;
    copqMtd: CopqSourceDebugMapping;
    copqQtd: CopqSourceDebugMapping;
    qaSaved: CopqSourceDebugMapping;
    beforeQaClearance: CopqSourceDebugMapping;
  };
  database: {
    latestKpiValue: {
      valueDecimal: string | null;
      previousValueDecimal: string | null;
      calculatedAt: string | null;
      metadataJson: unknown;
    } | null;
    copqAnalyticsMeta: {
      syncedAt: string | null;
      recordCount: number;
      headlineJson: Record<string, unknown> | null;
    } | null;
  };
  liveFetch: {
    attempted: boolean;
    success: boolean;
    error: string | null;
    workbookName: string | null;
    workbookModifiedTime: string | null;
    dashboardCells: Record<string, CopqSourceDebugCell> | null;
    ncRecords: CopqSourceDebugDataset | null;
    normalizedPreview: Record<string, string> | null;
  };
  finalKpiCard: KpiMetric | null;
}

export interface SnapshotSyncStartResponse {
  runId: string;
  status: 'running';
}

export interface SnapshotSyncStatusResponse {
  runId: string;
  running: boolean;
  status: string | null;
  scanned: number;
  processed: number;
  skipped: number;
  errors: Array<{ fileName: string; error: string }>;
  totalCached: number | null;
  todaySnapshotFound: boolean;
  newFilesDetected: number;
  errorMessage: string | null;
}

export interface SnapshotSyncResponse {
  scanned: number;
  processed: number;
  skipped: number;
  errors: Array<{ fileName: string; error: string }>;
  totalCached: number;
  todaySnapshotFound: boolean;
  runId: string;
}
