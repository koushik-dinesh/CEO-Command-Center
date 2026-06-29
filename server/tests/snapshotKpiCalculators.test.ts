import { KpiStatus } from '../src/db/types.js';
import { describe, expect, it } from 'vitest';
import { getCalculator } from '../src/kpis/registry.js';
import type { SnapshotKpiContext } from '../src/kpis/snapshotKpiContext.js';
import type { KpiSourceRecord } from '../src/kpis/types.js';

function record(date: string, normalized: Record<string, string>): KpiSourceRecord {
  return { sourceDate: new Date(date), normalized };
}

function snapshotContext(overrides: Partial<SnapshotKpiContext['metrics']> = {}): SnapshotKpiContext {
  return {
    metrics: {
      snapshotKey: '20260618_071700',
      snapshotDate: '2026-06-18',
      snapshotTimestamp: new Date('2026-06-18T07:17:00.000Z'),
      revenue: 5_000_000,
      grossProfit: 1_900_000,
      grossMargin: 38,
      ytdCogs: 3_100_000,
      daysElapsed: 170,
      inventoryDays: 75,
      itr: null,
      inventoryValue: 2_240_000,
      deadStock: 450_000,
      slowMovingStock: 920_000,
      reportCount: 6,
      completeness: 1,
      fileNames: ['Sales_Revenue_by_Customer_Group_20260618_071700.csv'],
      computedAt: new Date('2026-06-18T07:20:00.000Z'),
      createdAt: new Date('2026-06-18T07:20:00.000Z'),
      updatedAt: new Date('2026-06-18T07:20:00.000Z'),
      ...overrides,
    },
    payloads: {
      revenueVsCogs: {
        rows: [],
        total: {
          type: 'TOTAL',
          mtdRevenue: 400_000,
          mtdCogs: 250_000,
          qtdRevenue: 1_200_000,
          qtdCogs: 750_000,
          ytdRevenue: 5_000_000,
          ytdCogs: 3_100_000,
          grossProfitPct: 38,
        },
      },
      customerGroup: null,
      salesperson: null,
      productGroup: null,
    },
  };
}

describe('KPI calculators — snapshot pipeline', () => {
  const emptyStaging = new Map<string, KpiSourceRecord[]>();

  it('calculates revenue from snapshot metrics', () => {
    const result = getCalculator('REVENUE')!.calculate({
      recordsBySource: emptyStaging,
      snapshotContext: snapshotContext(),
    });
    expect(result.status).toBe(KpiStatus.CURRENT);
    expect(result.value?.toString()).toBe('5000000');
    expect(result.metadataJson).toMatchObject({
      dataSource: 'snapshot_pipeline',
      snapshotKey: '20260618_071700',
      revenueMtd: '400000',
      revenueQtd: '1200000',
      revenueYtd: '5000000',
    });
  });

  it('calculates inventory and COGS from snapshot metrics', () => {
    const context = { recordsBySource: emptyStaging, snapshotContext: snapshotContext() };
    expect(getCalculator('INVENTORY_VALUE')!.calculate(context).value?.toString()).toBe('2240000');
    expect(getCalculator('COGS')!.calculate(context).value?.toString()).toBe('3100000');
  });

  it('calculates revenue/hr ratio using snapshot revenue and staged HR cost', () => {
    const recordsBySource = new Map<string, KpiSourceRecord[]>([
      ['HR_COST_SHEET', [record('2026-06-01', { hrCost: '100000' })]],
    ]);
    const result = getCalculator('REVENUE_HR_COST_RATIO')!.calculate({
      recordsBySource,
      snapshotContext: snapshotContext(),
    });
    expect(result.value?.toString()).toBe('50');
  });

  it('returns unavailable when snapshot metrics are missing', () => {
    const context = { recordsBySource: emptyStaging, snapshotContext: null };
    expect(getCalculator('REVENUE')!.calculate(context).status).toBe(KpiStatus.UNAVAILABLE);
    expect(getCalculator('INVENTORY_VALUE')!.calculate(context).status).toBe(KpiStatus.UNAVAILABLE);
    expect(getCalculator('COGS')!.calculate(context).status).toBe(KpiStatus.UNAVAILABLE);
    expect(getCalculator('REVENUE_HR_COST_RATIO')!.calculate(context).status).toBe(KpiStatus.UNAVAILABLE);
  });
});
