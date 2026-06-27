import { getInventoryDaysTargets } from './kpiConfig.js';
import type { KpiMetric, MetricTrendPoint } from './types.js';

export type ImprovementDirection = 'higher' | 'lower';
export type KpiTrendDirection = 'higher_is_better' | 'lower_is_better' | 'target_range';
export type ChartSentiment = 'positive' | 'negative' | 'neutral' | 'warning';

export interface KpiTrendConfig {
  trendDirection: KpiTrendDirection;
  targetMin?: number;
  targetMax?: number;
}

export const KPI_TREND_CONFIG: Record<string, KpiTrendConfig> = {
  revenue: { trendDirection: 'higher_is_better' },
  grossProfit: { trendDirection: 'higher_is_better' },
  grossMargin: { trendDirection: 'higher_is_better' },
  pbt: { trendDirection: 'higher_is_better' },
  inventoryValue: { trendDirection: 'lower_is_better' },
  inventoryDays: {
    trendDirection: 'target_range',
    targetMin: getInventoryDaysTargets().targetMinDays,
    targetMax: getInventoryDaysTargets().targetMaxDays,
  },
  deadStock: { trendDirection: 'lower_is_better' },
  slowMoving: { trendDirection: 'lower_is_better' },
  copq: { trendDirection: 'lower_is_better' },
  productivityIndex: { trendDirection: 'higher_is_better' },
};

export function getKpiTrendConfig(kpiKey: string): KpiTrendConfig {
  if (kpiKey === 'inventoryDays') {
    const targets = getInventoryDaysTargets();
    return {
      trendDirection: 'target_range',
      targetMin: targets.targetMinDays,
      targetMax: targets.targetMaxDays,
    };
  }
  return KPI_TREND_CONFIG[kpiKey] ?? { trendDirection: 'higher_is_better' };
}

/** @deprecated Use getKpiTrendConfig */
export function getKpiEvaluationConfig(kpiKey: string): KpiTrendConfig & {
  evaluationType: KpiTrendDirection;
  targetMinDays?: number;
  targetMaxDays?: number;
} {
  const config = getKpiTrendConfig(kpiKey);
  return {
    ...config,
    evaluationType: config.trendDirection,
    targetMinDays: config.targetMin,
    targetMaxDays: config.targetMax,
  };
}

export function getImprovementDirection(kpiKey: string): ImprovementDirection {
  const config = getKpiTrendConfig(kpiKey);
  if (config.trendDirection === 'lower_is_better') return 'lower';
  return 'higher';
}

export function evaluateTargetRangeHealth(
  value: number | null,
  targetMin: number,
  targetMax: number,
): KpiMetric['health'] {
  if (value === null) return 'neutral';
  if (value < targetMin) return 'warning';
  if (value > targetMax) return 'critical';
  return 'good';
}

export function targetRangeStatusLabel(health: KpiMetric['health']): string {
  if (health === 'good') return 'Healthy';
  if (health === 'warning') return 'Warning';
  if (health === 'critical') return 'Worsened';
  return 'Unknown';
}

export function targetRangeStatusTooltip(health: KpiMetric['health']): string | null {
  if (health === 'warning') return 'Below recommended inventory level';
  if (health === 'critical') return 'Above recommended inventory level';
  return null;
}

export function healthToChartSentiment(health: KpiMetric['health']): ChartSentiment {
  if (health === 'good') return 'positive';
  if (health === 'warning') return 'warning';
  if (health === 'critical') return 'negative';
  return 'neutral';
}

export function resolveTrendSentiment(
  trend: KpiMetric['trend'],
  improvementDirection: ImprovementDirection,
): ChartSentiment {
  if (trend === 'FLAT' || trend === 'UNKNOWN') return 'neutral';
  if (trend === 'UP') return improvementDirection === 'higher' ? 'positive' : 'negative';
  return improvementDirection === 'higher' ? 'negative' : 'positive';
}

export function resolveTrendSentimentFromValues(
  current: number | null,
  previous: number | null,
  trendDirection: KpiTrendDirection,
): ChartSentiment {
  if (current === null || previous === null) return 'neutral';
  if (current === previous) return 'neutral';
  const trend: KpiMetric['trend'] = current > previous ? 'UP' : 'DOWN';
  const improvementDirection: ImprovementDirection = trendDirection === 'lower_is_better' ? 'lower' : 'higher';
  return resolveTrendSentiment(trend, improvementDirection);
}

export function resolveTrendLabel(
  trend: KpiMetric['trend'],
  improvementDirection: ImprovementDirection,
): string {
  if (trend === 'UNKNOWN') return 'New';
  if (trend === 'FLAT') return 'Unchanged';
  const sentiment = resolveTrendSentiment(trend, improvementDirection);
  if (sentiment === 'positive') return 'Improved';
  if (sentiment === 'negative') return 'Worsened';
  return 'Unchanged';
}

export function healthFromTrendSentiment(sentiment: ChartSentiment): KpiMetric['health'] {
  if (sentiment === 'positive') return 'good';
  if (sentiment === 'negative') return 'critical';
  if (sentiment === 'warning') return 'warning';
  return 'neutral';
}

export function resolveChartSentimentFromValue(
  value: number | null,
  targetMin: number,
  targetMax: number,
): ChartSentiment {
  return healthToChartSentiment(evaluateTargetRangeHealth(value, targetMin, targetMax));
}

/** @deprecated Chart color should follow current vs previous, not history slope. */
export function resolveChartSentimentFromHistory(
  history: MetricTrendPoint[],
  improvementDirection: ImprovementDirection,
): ChartSentiment {
  if (history.length < 2) return 'neutral';
  const previous = history[history.length - 2]!.value;
  const current = history[history.length - 1]!.value;
  const trend: KpiMetric['trend'] = current > previous ? 'UP' : current < previous ? 'DOWN' : 'FLAT';
  return resolveTrendSentiment(trend, improvementDirection);
}

export function resolveKpiVisualSentiment(kpi: Pick<KpiMetric, 'key' | 'value' | 'previousValue' | 'trend' | 'trendDirection' | 'targetMinDays' | 'targetMaxDays'>): ChartSentiment {
  const config = getKpiTrendConfig(kpi.key);

  if (config.trendDirection === 'target_range') {
    const targetMin = kpi.targetMinDays ?? config.targetMin ?? getInventoryDaysTargets().targetMinDays;
    const targetMax = kpi.targetMaxDays ?? config.targetMax ?? getInventoryDaysTargets().targetMaxDays;
    return resolveChartSentimentFromValue(kpi.value, targetMin, targetMax);
  }

  return resolveTrendSentimentFromValues(kpi.value, kpi.previousValue, config.trendDirection);
}

export function applyKpiSemantics(
  kpi: Omit<KpiMetric, 'trendDirection' | 'improvementDirection' | 'trendSentiment' | 'trendLabel' | 'chartSentiment' | 'statusTooltip' | 'targetMinDays' | 'targetMaxDays'> & {
    improvementDirection?: ImprovementDirection;
    trendDirection?: KpiTrendDirection;
    targetMinDays?: number;
    targetMaxDays?: number;
    statusTooltip?: string | null;
  },
): KpiMetric {
  const config = getKpiTrendConfig(kpi.key);

  if (config.trendDirection === 'target_range') {
    const targetMinDays = kpi.targetMinDays ?? config.targetMin ?? getInventoryDaysTargets().targetMinDays;
    const targetMaxDays = kpi.targetMaxDays ?? config.targetMax ?? getInventoryDaysTargets().targetMaxDays;
    const health = evaluateTargetRangeHealth(kpi.value, targetMinDays, targetMaxDays);
    const chartSentiment = healthToChartSentiment(health);
    const statusTooltip = kpi.statusTooltip ?? targetRangeStatusTooltip(health);

    return {
      ...kpi,
      trendDirection: 'target_range',
      improvementDirection: 'lower',
      targetMinDays,
      targetMaxDays,
      health,
      trendLabel: targetRangeStatusLabel(health),
      statusTooltip,
      trendSentiment: chartSentiment,
      chartSentiment,
    };
  }

  const improvementDirection = kpi.improvementDirection ?? getImprovementDirection(kpi.key);
  const trendSentiment = resolveTrendSentiment(kpi.trend, improvementDirection);
  const trendLabel = resolveTrendLabel(kpi.trend, improvementDirection);
  const chartSentiment = trendSentiment;

  return {
    ...kpi,
    trendDirection: config.trendDirection,
    improvementDirection,
    trendSentiment,
    trendLabel,
    chartSentiment,
    statusTooltip: kpi.statusTooltip ?? null,
    targetMinDays: undefined,
    targetMaxDays: undefined,
  };
}
