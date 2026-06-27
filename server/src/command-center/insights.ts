import { Decimal } from 'decimal.js';
import type { ComparisonMetric, ExecutiveInsight, KpiMetric, MetricTrendPoint } from './types.js';
import type {
  DeadSlowStockPayload,
  InventoryWarehousePayload,
  RevenueCustomerGroupPayload,
  RevenueProductGroupPayload,
  RevenueSalespersonPayload,
  RevenueVsCogsPayload,
} from '../reports/types.js';
import {
  applyKpiSemantics,
  getImprovementDirection,
  getKpiTrendConfig,
  healthFromTrendSentiment,
  resolveTrendLabel,
  resolveTrendSentiment,
  type ImprovementDirection,
} from './kpiSemantics.js';

export function trendDirection(current: number | null, previous: number | null): KpiMetric['trend'] {
  if (current === null || previous === null) return 'UNKNOWN';
  if (current > previous) return 'UP';
  if (current < previous) return 'DOWN';
  return 'FLAT';
}

export function changeMetrics(current: number | null, previous: number | null) {
  if (current === null || previous === null) {
    return { changePercent: null, changeAbsolute: null, trend: 'UNKNOWN' as const };
  }
  const changeAbsolute = new Decimal(current).minus(previous).toNumber();
  const changePercent = previous === 0
    ? null
    : new Decimal(changeAbsolute).div(Math.abs(previous)).mul(100).toDecimalPlaces(2).toNumber();
  return { changePercent, changeAbsolute, trend: trendDirection(current, previous) };
}

export function buildKpi(
  key: string,
  label: string,
  value: number | null,
  previousValue: number | null,
  unit: KpiMetric['unit'],
  history: MetricTrendPoint[],
  health?: KpiMetric['health'],
  subMetrics?: KpiMetric['subMetrics'],
  options?: {
    improvementDirection?: ImprovementDirection;
    healthFromTrend?: boolean;
  },
): KpiMetric {
  const { changePercent, changeAbsolute, trend } = changeMetrics(value, previousValue);
  const evalConfig = getKpiTrendConfig(key);
  const improvementDirection = options?.improvementDirection ?? getImprovementDirection(key);
  const trendSentiment = resolveTrendSentiment(trend, improvementDirection);
  const useTrendHealth = evalConfig.trendDirection !== 'target_range'
    && (options?.healthFromTrend ?? health === undefined);
  const resolvedHealth = useTrendHealth ? healthFromTrendSentiment(trendSentiment) : (health ?? 'neutral');

  return applyKpiSemantics({
    key,
    label,
    value,
    previousValue,
    changePercent,
    changeAbsolute,
    trend,
    unit,
    history,
    health: resolvedHealth,
    subMetrics,
    improvementDirection,
  });
}

export function buildComparisonMetric(
  key: string,
  label: string,
  current: number | null,
  previous: number | null,
): ComparisonMetric {
  const { changePercent, changeAbsolute, trend } = changeMetrics(current, previous);
  const improvementDirection = getImprovementDirection(key);
  const trendSentiment = resolveTrendSentiment(trend, improvementDirection);
  return {
    key,
    label,
    current,
    previous,
    absoluteChange: changeAbsolute,
    percentChange: changePercent,
    trend,
    improvementDirection,
    trendSentiment,
    trendLabel: resolveTrendLabel(trend, improvementDirection),
  };
}

export function generateInsights(input: {
  revenue: number | null;
  previousRevenue: number | null;
  grossMarginPct: number | null;
  previousGrossMarginPct: number | null;
  inventoryValue: number | null;
  previousInventoryValue: number | null;
  deadStockValue: number | null;
  previousDeadStockValue: number | null;
  slowMovingValue: number | null;
  previousSlowMovingValue: number | null;
  topSalesperson?: { name: string; contributionPct: number };
  topWarehouse?: { name: string; contributionPct: number };
}): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  let id = 0;
  const nextId = () => `insight_${++id}`;

  const revenueChange = changeMetrics(input.revenue, input.previousRevenue);
  if (revenueChange.changePercent !== null) {
    const direction = revenueChange.changePercent >= 0 ? 'increased' : 'decreased';
    insights.push({
      id: nextId(),
      category: 'revenue',
      severity: revenueChange.changePercent >= 0 ? 'positive' : 'negative',
      message: `Revenue ${direction} by ${Math.abs(revenueChange.changePercent).toFixed(1)}% compared to the previous snapshot.`,
    });
  }

  if (input.grossMarginPct !== null && input.previousGrossMarginPct !== null) {
    const marginDelta = new Decimal(input.grossMarginPct).minus(input.previousGrossMarginPct).toDecimalPlaces(1).toNumber();
    if (marginDelta !== 0) {
      insights.push({
        id: nextId(),
        category: 'profitability',
        severity: marginDelta > 0 ? 'positive' : 'negative',
        message: `Gross margin ${marginDelta > 0 ? 'improved' : 'declined'} by ${Math.abs(marginDelta).toFixed(1)} percentage points.`,
      });
    }
  }

  const inventoryChange = changeMetrics(input.inventoryValue, input.previousInventoryValue);
  if (inventoryChange.changePercent !== null) {
    insights.push({
      id: nextId(),
      category: 'inventory',
      severity: inventoryChange.changePercent <= 0 ? 'positive' : 'warning',
      message: `Inventory ${inventoryChange.changePercent <= 0 ? 'reduced' : 'increased'} by ${Math.abs(inventoryChange.changePercent).toFixed(1)}%.`,
    });
  }

  const deadChange = changeMetrics(input.deadStockValue, input.previousDeadStockValue);
  if (deadChange.changeAbsolute !== null && deadChange.changeAbsolute !== 0) {
    insights.push({
      id: nextId(),
      category: 'risk',
      severity: deadChange.changeAbsolute <= 0 ? 'positive' : 'warning',
      message: `Dead stock ${deadChange.changeAbsolute <= 0 ? 'reduced' : 'increased'} by ₹${Math.abs(deadChange.changeAbsolute).toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`,
    });
  }

  if (input.topSalesperson) {
    insights.push({
      id: nextId(),
      category: 'growth',
      severity: 'neutral',
      message: `Top contributing salesperson ${input.topSalesperson.name} generated ${input.topSalesperson.contributionPct.toFixed(1)}% of total revenue.`,
    });
  }

  if (input.topWarehouse) {
    insights.push({
      id: nextId(),
      category: 'inventory',
      severity: input.topWarehouse.contributionPct > 35 ? 'warning' : 'neutral',
      message: `${input.topWarehouse.name} holds ${input.topWarehouse.contributionPct.toFixed(1)}% of total inventory.`,
    });
  }

  const slowChange = changeMetrics(input.slowMovingValue, input.previousSlowMovingValue);
  if (slowChange.changePercent !== null && Math.abs(slowChange.changePercent) >= 1) {
    insights.push({
      id: nextId(),
      category: 'risk',
      severity: (slowChange.changePercent ?? 0) <= 0 ? 'positive' : 'warning',
      message: `Slow-moving stock ${(slowChange.changePercent ?? 0) <= 0 ? 'reduced' : 'increased'} by ${Math.abs(slowChange.changePercent ?? 0).toFixed(1)}%.`,
    });
  }

  return insights.slice(0, 6);
}

function pctChange(current: number | null, previous: number | null): string | null {
  const { changePercent } = changeMetrics(current, previous);
  if (changePercent === null) return null;
  const dir = changePercent >= 0 ? 'increased' : 'decreased';
  return `${dir} by ${Math.abs(changePercent).toFixed(1)}%`;
}

export function generateDrilldownSummaries(input: {
  currentMetrics: ReturnType<typeof extractCoreMetrics>;
  previousMetrics: ReturnType<typeof extractCoreMetrics>;
  revenue: {
    bySalesperson: Array<{ name: string; value: number; contributionPct: number }>;
    byCustomerGroup: Array<{ name: string; value: number; contributionPct: number }>;
    byProductGroup: Array<{ name: string; value: number; contributionPct: number }>;
  };
  profitability: { byCategory: Array<{ type: string; marginPct: number; revenue: number }> };
  inventory: { byWarehouse: Array<{ name: string; contributionPct: number; value: number }> };
  deadStock: { agingBuckets: Array<{ label: string; value: number }>; topProblemItems: Array<{ description: string; status: string }> };
  pbt?: {
    profitBeforeTax: number | null;
    directExpense: number | null;
    indirectExpense: number | null;
    insights: Array<{ message: string }>;
  };
}): {
  revenue: { title: string; bullets: string[] };
  profitability: { title: string; bullets: string[] };
  inventory: { title: string; bullets: string[] };
  deadStock: { title: string; bullets: string[] };
  pbt: { title: string; bullets: string[] };
} {
  const revChange = pctChange(input.currentMetrics.revenue, input.previousMetrics.revenue);
  const topSales = input.revenue.bySalesperson[0];
  const topCustomer = input.revenue.byCustomerGroup[0];
  const topProduct = input.revenue.byProductGroup[0];
  const revenueBullets: string[] = [];
  if (revChange) revenueBullets.push(`Revenue ${revChange} compared to the previous snapshot.`);
  if (topCustomer) revenueBullets.push(`${topCustomer.name} is the largest customer group at ${topCustomer.contributionPct.toFixed(1)}% of revenue.`);
  if (topSales) revenueBullets.push(`${topSales.name} is the top salesperson contributing ${topSales.contributionPct.toFixed(1)}% of revenue.`);
  if (topProduct) revenueBullets.push(`${topProduct.name} leads product groups with ${topProduct.contributionPct.toFixed(1)}% share.`);

  const marginDelta = input.currentMetrics.grossMarginPct !== null && input.previousMetrics.grossMarginPct !== null
    ? new Decimal(input.currentMetrics.grossMarginPct).minus(input.previousMetrics.grossMarginPct).toDecimalPlaces(1).toNumber()
    : null;
  const profitabilityBullets: string[] = [];
  if (marginDelta !== null && marginDelta !== 0) {
    profitabilityBullets.push(`Gross margin ${marginDelta > 0 ? 'improved' : 'declined'} by ${Math.abs(marginDelta).toFixed(1)} percentage points.`);
  }
  const bestCategory = [...input.profitability.byCategory].sort((a, b) => b.marginPct - a.marginPct)[0];
  const worstCategory = [...input.profitability.byCategory].sort((a, b) => a.marginPct - b.marginPct)[0];
  if (bestCategory) profitabilityBullets.push(`${bestCategory.type} delivers the highest margin at ${bestCategory.marginPct.toFixed(1)}%.`);
  if (worstCategory && worstCategory.type !== bestCategory?.type) {
    profitabilityBullets.push(`${worstCategory.type} has the lowest margin at ${worstCategory.marginPct.toFixed(1)}% and may need management focus.`);
  }
  const gpChange = pctChange(input.currentMetrics.grossProfit, input.previousMetrics.grossProfit);
  if (gpChange) profitabilityBullets.push(`Gross profit ${gpChange} versus the prior period.`);

  const invChange = pctChange(input.currentMetrics.inventoryValue, input.previousMetrics.inventoryValue);
  const topWarehouse = input.inventory.byWarehouse[0];
  const inventoryBullets: string[] = [];
  if (invChange) inventoryBullets.push(`Total inventory ${invChange} compared to the previous snapshot.`);
  if (topWarehouse) inventoryBullets.push(`${topWarehouse.name} holds ${topWarehouse.contributionPct.toFixed(1)}% of total inventory value.`);
  const top3Share = input.inventory.byWarehouse.slice(0, 3).reduce((sum, row) => sum + row.contributionPct, 0);
  if (top3Share > 0) inventoryBullets.push(`Top 3 warehouses account for ${top3Share.toFixed(1)}% of inventory concentration.`);

  const deadChange = pctChange(input.currentMetrics.deadStockValue, input.previousMetrics.deadStockValue);
  const slowChange = pctChange(input.currentMetrics.slowMovingValue, input.previousMetrics.slowMovingValue);
  const deadBullets: string[] = [];
  if (deadChange) deadBullets.push(`Dead stock ${deadChange} versus the previous snapshot.`);
  if (slowChange) deadBullets.push(`Slow-moving stock ${slowChange} versus the previous snapshot.`);
  const largestAging = [...input.deadStock.agingBuckets].sort((a, b) => b.value - a.value)[0];
  if (largestAging && largestAging.value > 0) {
    deadBullets.push(`${largestAging.label} aging bucket holds the highest problem inventory exposure.`);
  }
  if (input.deadStock.topProblemItems[0]) {
    deadBullets.push(`Highest-risk item: ${input.deadStock.topProblemItems[0].description} (${input.deadStock.topProblemItems[0].status}).`);
  }

  const pbtBullets: string[] = [];
  if (input.pbt) {
    if (input.pbt.profitBeforeTax !== null) {
      pbtBullets.push(`Latest Profit Before Tax is ₹${input.pbt.profitBeforeTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`);
    }
    if (input.pbt.directExpense !== null && input.pbt.indirectExpense !== null) {
      pbtBullets.push(`Total operating expenses: ₹${(input.pbt.directExpense + input.pbt.indirectExpense).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (direct + indirect).`);
    }
    for (const insight of input.pbt.insights.slice(0, 2)) {
      pbtBullets.push(insight.message);
    }
  }
  if (pbtBullets.length === 0) {
    pbtBullets.push('No monthly expense data entered yet. Add direct and indirect expenses in Finance → Profit Before Tax.');
  }

  return {
    revenue: { title: 'Revenue Executive Summary', bullets: revenueBullets.slice(0, 4) },
    profitability: { title: 'Profitability Executive Summary', bullets: profitabilityBullets.slice(0, 4) },
    inventory: { title: 'Inventory Executive Summary', bullets: inventoryBullets.slice(0, 4) },
    deadStock: { title: 'Dead & Slow Moving Executive Summary', bullets: deadBullets.slice(0, 4) },
    pbt: { title: 'Profit Before Tax Executive Summary', bullets: pbtBullets.slice(0, 4) },
  };
}

type RevenuePayloadBundle = {
  revenueVsCogs: RevenueVsCogsPayload | null;
  salesperson: RevenueSalespersonPayload | null;
  customerGroup: RevenueCustomerGroupPayload | null;
  productGroup: RevenueProductGroupPayload | null;
};

function positive(value: number | null | undefined): number | null {
  if (value == null || value <= 0) return null;
  return value;
}

function sumRows<T>(rows: T[], pick: (row: T) => number): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + pick(row), 0);
  return total > 0 ? total : null;
}

function pickRevenueFromCogsTotal(
  period: 'ytd' | 'qtd' | 'mtd',
  total: RevenueVsCogsPayload['total'],
): number | null {
  if (!total) return null;
  if (period === 'ytd') return positive(total.ytdRevenue);
  if (period === 'qtd') return positive(total.qtdRevenue);
  return positive(total.mtdRevenue);
}

function pickRevenuePeriod(period: 'ytd' | 'qtd' | 'mtd', payloads: RevenuePayloadBundle): number | null {
  const fromCogs = pickRevenueFromCogsTotal(period, payloads.revenueVsCogs?.total ?? null);
  if (fromCogs != null) return fromCogs;

  if (period === 'ytd') {
    const candidates = [
      payloads.salesperson?.totalYtd,
      payloads.customerGroup?.totalYtd,
      payloads.productGroup?.totalYtd,
    ];
    for (const value of candidates) {
      if (value != null && value > 0) return value;
    }
    return null;
  }

  const customerGroupRows = payloads.customerGroup?.rows ?? [];
  const salespersonRows = payloads.salesperson?.rows ?? [];
  const productGroupRows = payloads.productGroup?.rows ?? [];

  if (period === 'qtd') {
    return sumRows(customerGroupRows, (row) => row.qtd)
      ?? sumRows(salespersonRows, (row) => row.qtd)
      ?? sumRows(productGroupRows, (row) => row.qtdAmount);
  }

  return sumRows(customerGroupRows, (row) => row.mtd)
    ?? sumRows(salespersonRows, (row) => row.mtd)
    ?? sumRows(productGroupRows, (row) => row.mtdAmount);
}

function pickRevenue(payloads: RevenuePayloadBundle): number | null {
  return pickRevenuePeriod('ytd', payloads);
}

export function extractRevenuePeriods(payloads: RevenuePayloadBundle) {
  return {
    revenueYTD: pickRevenuePeriod('ytd', payloads),
    revenueQTD: pickRevenuePeriod('qtd', payloads),
    revenueMTD: pickRevenuePeriod('mtd', payloads),
  };
}

export function buildRevenueSubMetrics(periods: ReturnType<typeof extractRevenuePeriods>): KpiMetric['subMetrics'] {
  return [
    { key: 'ytd', label: 'YTD', value: periods.revenueYTD, unit: 'currency', role: 'headline-tag' },
    { key: 'qtd', label: 'QTD', value: periods.revenueQTD, unit: 'currency', role: 'pill' },
    { key: 'mtd', label: 'MTD', value: periods.revenueMTD, unit: 'currency', role: 'pill' },
  ];
}

function metadataDecimal(metadata: unknown, key: string): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>)[key];
  if (raw == null || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildCopqSubMetrics(metadata: unknown, o34Ytd: number | null = null): KpiMetric['subMetrics'] {
  const ytd = o34Ytd;
  const qtd = metadataDecimal(metadata, 'copqQtd');
  const mtd = metadataDecimal(metadata, 'copqMtd');
  const beforeQa = metadataDecimal(metadata, 'copqBeforeQaClearance');
  const qaSaved = metadataDecimal(metadata, 'qaSavedAmount');

  const subMetrics: KpiMetric['subMetrics'] = [
    { key: 'ytd', label: 'YTD', value: ytd, unit: 'currency', role: 'headline-tag' },
    { key: 'qtd', label: 'QTD', value: qtd, unit: 'currency', role: 'pill' },
    { key: 'mtd', label: 'MTD', value: mtd, unit: 'currency', role: 'pill' },
  ];

  if (beforeQa != null) {
    subMetrics.push({
      key: 'beforeQa',
      label: 'Before QA Clearance',
      value: beforeQa,
      unit: 'currency',
      role: 'pill',
    });
  }

  if (qaSaved != null && qaSaved > 0) {
    subMetrics.push({
      key: 'qaSaved',
      label: 'QA Saved',
      value: qaSaved,
      unit: 'currency',
      role: 'pill',
    });
  }

  return subMetrics;
}

export function extractCoreMetrics(payloads: {
  revenueVsCogs: RevenueVsCogsPayload | null;
  inventory: InventoryWarehousePayload | null;
  deadStock: DeadSlowStockPayload | null;
  salesperson: RevenueSalespersonPayload | null;
  customerGroup?: RevenueCustomerGroupPayload | null;
  productGroup?: RevenueProductGroupPayload | null;
}) {
  const total = payloads.revenueVsCogs?.total;
  const revenue = pickRevenue({
    revenueVsCogs: payloads.revenueVsCogs ?? null,
    salesperson: payloads.salesperson ?? null,
    customerGroup: payloads.customerGroup ?? null,
    productGroup: payloads.productGroup ?? null,
  });
  const cogs = total?.ytdCogs ?? null;
  const grossProfit = revenue !== null && cogs !== null ? revenue - cogs : null;
  const grossMarginPct = total?.grossProfitPct ?? (grossProfit !== null && revenue ? (grossProfit / revenue) * 100 : null);

  return {
    revenue,
    grossProfit,
    grossMarginPct,
    ytdCogs: cogs,
    inventoryValue: payloads.inventory?.totalValue ?? null,
    deadStockValue: payloads.deadStock?.deadStockValue ?? null,
    slowMovingValue: payloads.deadStock?.slowMovingValue ?? null,
  };
}
