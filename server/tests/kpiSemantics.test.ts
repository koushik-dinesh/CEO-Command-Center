import { describe, expect, it } from 'vitest';
import {
  applyKpiSemantics,
  evaluateTargetRangeHealth,
  getImprovementDirection,
  getKpiTrendConfig,
  healthToChartSentiment,
  resolveChartSentimentFromValue,
  resolveKpiVisualSentiment,
  resolveTrendLabel,
  resolveTrendSentiment,
  resolveTrendSentimentFromValues,
  targetRangeStatusLabel,
  targetRangeStatusTooltip,
} from '../src/command-center/kpiSemantics.js';

describe('kpiSemantics', () => {
  it('treats higher-is-better KPIs with revenue-style sentiment', () => {
    expect(getImprovementDirection('revenue')).toBe('higher');
    expect(getKpiTrendConfig('revenue').trendDirection).toBe('higher_is_better');
    expect(resolveTrendSentiment('UP', 'higher')).toBe('positive');
    expect(resolveTrendSentiment('DOWN', 'higher')).toBe('negative');
    expect(resolveTrendLabel('UP', 'higher')).toBe('Improved');
    expect(resolveTrendLabel('DOWN', 'higher')).toBe('Worsened');
  });

  it('treats lower-is-better KPIs with inverted sentiment', () => {
    expect(getImprovementDirection('slowMoving')).toBe('lower');
    expect(resolveTrendSentiment('UP', 'lower')).toBe('negative');
    expect(resolveTrendSentiment('DOWN', 'lower')).toBe('positive');
    expect(resolveTrendLabel('UP', 'lower')).toBe('Worsened');
    expect(resolveTrendLabel('DOWN', 'lower')).toBe('Improved');
  });

  it('derives directional chart color from current vs previous, not history slope', () => {
    const kpi = applyKpiSemantics({
      key: 'revenue',
      label: 'Revenue',
      value: 120,
      previousValue: 100,
      changePercent: 20,
      changeAbsolute: 20,
      trend: 'UP',
      unit: 'currency',
      history: [
        { snapshotKey: 'a', snapshotDate: '2026-01-01', value: 200 },
        { snapshotKey: 'b', snapshotDate: '2026-02-01', value: 80 },
      ],
      health: 'good',
    });

    expect(kpi.chartSentiment).toBe('positive');
    expect(kpi.trendSentiment).toBe('positive');
    expect(kpi.trendLabel).toBe('Improved');
  });

  it('evaluates inventory days with target-range health', () => {
    const config = getKpiTrendConfig('inventoryDays');
    expect(config.trendDirection).toBe('target_range');
    expect(config.targetMin).toBeGreaterThan(0);
    expect(config.targetMax).toBeGreaterThan(config.targetMin!);

    const min = config.targetMin!;
    const max = config.targetMax!;

    expect(evaluateTargetRangeHealth(75, min, max)).toBe('good');
    expect(evaluateTargetRangeHealth(95, min, max)).toBe('critical');
    expect(evaluateTargetRangeHealth(40, min, max)).toBe('warning');
    expect(targetRangeStatusLabel('good')).toBe('Healthy');
    expect(targetRangeStatusLabel('warning')).toBe('Warning');
    expect(targetRangeStatusLabel('critical')).toBe('Worsened');
    expect(targetRangeStatusTooltip('warning')).toBe('Below recommended inventory level');
    expect(targetRangeStatusTooltip('critical')).toBe('Above recommended inventory level');
  });

  it('colors inventory-days visuals from current value health', () => {
    const min = 60;
    const max = 90;

    expect(resolveChartSentimentFromValue(75, min, max)).toBe('positive');
    expect(resolveChartSentimentFromValue(95, min, max)).toBe('negative');
    expect(resolveChartSentimentFromValue(80, min, max)).toBe('positive');
    expect(resolveChartSentimentFromValue(40, min, max)).toBe('warning');
    expect(resolveChartSentimentFromValue(105, min, max)).toBe('negative');
    expect(healthToChartSentiment('warning')).toBe('warning');

    const inventoryKpi = applyKpiSemantics({
      key: 'inventoryDays',
      label: 'Inventory Days',
      value: 95,
      previousValue: 85,
      changePercent: 11.76,
      changeAbsolute: 10,
      trend: 'UP',
      unit: 'days',
      history: [
        { snapshotKey: 'a', snapshotDate: '2026-01-01', value: 70 },
        { snapshotKey: 'b', snapshotDate: '2026-02-01', value: 75 },
      ],
      health: 'neutral',
    });

    expect(inventoryKpi.chartSentiment).toBe('negative');
    expect(inventoryKpi.trendLabel).toBe('Worsened');
    expect(resolveKpiVisualSentiment(inventoryKpi)).toBe('negative');
  });

  it('maps directional comparison examples to expected sentiment', () => {
    expect(resolveTrendSentimentFromValues(95, 85, 'lower_is_better')).toBe('negative');
    expect(resolveTrendSentimentFromValues(80, 95, 'lower_is_better')).toBe('positive');
    expect(resolveChartSentimentFromValue(75, 60, 90)).toBe('positive');
    expect(resolveChartSentimentFromValue(65, 60, 90)).toBe('positive');
  });
});
