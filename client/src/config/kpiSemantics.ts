import type { KpiMetric } from '../types/command-center';

export type ImprovementDirection = 'higher' | 'lower';
export type KpiTrendDirection = 'higher_is_better' | 'lower_is_better' | 'target_range';
export type ChartSentiment = 'positive' | 'negative' | 'neutral' | 'warning';

export interface KpiTrendConfig {
  trendDirection: KpiTrendDirection;
  targetMin?: number;
  targetMax?: number;
}

/** Client defaults mirror server env fallbacks; live KPI payloads include authoritative targets. */
export const DEFAULT_INVENTORY_DAYS_TARGET_MIN = 60;
export const DEFAULT_INVENTORY_DAYS_TARGET_MAX = 90;

export const KPI_TREND_CONFIG: Record<string, KpiTrendConfig> = {
  revenue: { trendDirection: 'higher_is_better' },
  grossProfit: { trendDirection: 'higher_is_better' },
  grossMargin: { trendDirection: 'higher_is_better' },
  pbt: { trendDirection: 'higher_is_better' },
  inventoryValue: { trendDirection: 'lower_is_better' },
  inventoryDays: {
    trendDirection: 'target_range',
    targetMin: DEFAULT_INVENTORY_DAYS_TARGET_MIN,
    targetMax: DEFAULT_INVENTORY_DAYS_TARGET_MAX,
  },
  deadStock: { trendDirection: 'lower_is_better' },
  slowMoving: { trendDirection: 'lower_is_better' },
  copq: { trendDirection: 'lower_is_better' },
  productivityIndex: { trendDirection: 'higher_is_better' },
};

export function getKpiTrendConfig(kpiKey: string): KpiTrendConfig {
  if (kpiKey === 'inventoryDays') {
    return KPI_TREND_CONFIG.inventoryDays!;
  }
  return KPI_TREND_CONFIG[kpiKey] ?? { trendDirection: 'higher_is_better' };
}

export function getImprovementDirection(kpiKey: string): ImprovementDirection {
  const config = getKpiTrendConfig(kpiKey);
  return config.trendDirection === 'lower_is_better' ? 'lower' : 'higher';
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
  const improvementDirection = trendDirection === 'lower_is_better' ? 'lower' : 'higher';
  return resolveTrendSentiment(trend, improvementDirection);
}

export function resolveKpiVisualSentiment(kpi: KpiMetric): ChartSentiment {
  if (kpi.chartSentiment) return kpi.chartSentiment;

  const trendDirection = kpi.trendDirection ?? getKpiTrendConfig(kpi.key).trendDirection;

  if (trendDirection === 'target_range') {
    const config = getKpiTrendConfig(kpi.key);
    const targetMin = kpi.targetMinDays ?? config.targetMin ?? DEFAULT_INVENTORY_DAYS_TARGET_MIN;
    const targetMax = kpi.targetMaxDays ?? config.targetMax ?? DEFAULT_INVENTORY_DAYS_TARGET_MAX;
    return healthToChartSentiment(evaluateTargetRangeHealth(kpi.value, targetMin, targetMax));
  }

  if (kpi.trendSentiment) return kpi.trendSentiment;
  return resolveTrendSentimentFromValues(kpi.value, kpi.previousValue, trendDirection);
}

export function sentimentCssClass(sentiment: ChartSentiment): string {
  if (sentiment === 'positive') return 'trend-positive';
  if (sentiment === 'negative') return 'trend-negative';
  if (sentiment === 'warning') return 'trend-warning';
  return 'trend-neutral';
}

export function sentimentColor(sentiment: ChartSentiment): string {
  if (sentiment === 'positive') return 'var(--success)';
  if (sentiment === 'negative') return 'var(--danger)';
  if (sentiment === 'warning') return 'var(--warning)';
  return 'var(--chart-line)';
}

export function sentimentGlow(sentiment: ChartSentiment): string {
  if (sentiment === 'positive') {
    return 'drop-shadow(0 0 8px color-mix(in srgb, var(--success) 50%, transparent))';
  }
  if (sentiment === 'negative') {
    return 'drop-shadow(0 0 8px color-mix(in srgb, var(--danger) 50%, transparent))';
  }
  if (sentiment === 'warning') {
    return 'drop-shadow(0 0 8px color-mix(in srgb, var(--warning) 50%, transparent))';
  }
  return 'none';
}

/** @deprecated Use resolveKpiVisualSentiment */
export function kpiChartSentiment(kpi: KpiMetric): ChartSentiment {
  return resolveKpiVisualSentiment(kpi);
}

/** @deprecated Use resolveKpiVisualSentiment */
export function kpiDisplaySentiment(kpi: KpiMetric): ChartSentiment {
  return resolveKpiVisualSentiment(kpi);
}

export function resolveChartSentimentFromSeries(
  data: Array<{ value: number }>,
  trendDirection: KpiTrendDirection,
): ChartSentiment {
  if (trendDirection === 'target_range') return 'neutral';
  if (data.length < 2) return 'neutral';
  const previous = data[data.length - 2]!.value;
  const current = data[data.length - 1]!.value;
  return resolveTrendSentimentFromValues(current, previous, trendDirection);
}
