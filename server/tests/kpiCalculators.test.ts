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

describe('KPI calculators', () => {
  const recordsBySource = new Map<string, KpiSourceRecord[]>([
    ['COPQ_DASHBOARD_SHEET', [record('2026-06-02', {
      copqCost: '321762.5899',
      totalCopq: '321762.5899',
      copqYtd: '321762.5899',
      copqMtd: '50000',
      copqQtd: '200000',
      copqBeforeQaClearance: '583944.0492',
      qaSavedAmount: '211008.8452771799',
      sourceWorkbookName: 'NC REGISTER - BMC/QC/05',
      sourceSheetName: 'Dashboard',
      sourceCell: 'O34',
      sourceCellFormula: '=G167',
      sourceCellValueType: 'formula',
      copqBeforeQaClearanceCell: 'T13',
      copqBeforeQaClearanceFormula: "='Form Responses 1'!BC1",
      qaSavedAmountCell: 'T5',
      qaSavedAmountFormula: "='Form Responses 1'!BC1-'Form Responses 1'!AT1",
      copqReferenceDate: '2026-06-18',
      copqFinancialYearStart: '2026-04-01',
      copqQuarterStart: '2026-04-01',
      copqMonthStart: '2026-06-01',
      copqMtdRowCount: '2',
      copqQtdRowCount: '4',
    })]],
    ['HR_COST_SHEET', [record('2026-06-01', { hrCost: '90000' })]],
  ]);

  const snapshotBackedContext = {
    recordsBySource,
    snapshotContext: snapshotContext(),
  };

  it('calculates revenue from snapshot metrics', () => {
    const result = getCalculator('REVENUE')!.calculate(snapshotBackedContext);
    expect(result.status).toBe(KpiStatus.CURRENT);
    expect(result.value?.toString()).toBe('5000000');
    expect(result.metadataJson).toMatchObject({
      dataSource: 'snapshot_pipeline',
      revenueYtd: '5000000',
    });
  });

  it('calculates COGS from snapshot metrics', () => {
    const result = getCalculator('COGS')!.calculate(snapshotBackedContext);
    expect(result.value?.toString()).toBe('3100000');
  });

  it('calculates inventory from snapshot metrics', () => {
    const result = getCalculator('INVENTORY_VALUE')!.calculate(snapshotBackedContext);
    expect(result.value?.toString()).toBe('2240000');
  });

  it('calculates COPQ from staged dashboard values', () => {
    const result = getCalculator('COPQ')!.calculate({ recordsBySource });
    expect(result.value?.toString()).toBe('321762.5899');
    expect(result.metadataJson).toMatchObject({
      totalCopq: '321762.5899',
      copqYtd: '321762.5899',
      copqMtd: '50000',
      copqQtd: '200000',
      copqBeforeQaClearance: '583944.0492',
      sourceWorkbookName: 'NC REGISTER - BMC/QC/05',
      sourceSheetName: 'Dashboard',
      sourceCell: 'O34',
      sourceCellValueType: 'formula',
    });
  });

  it('rejects non-O34 COPQ headline cells', () => {
    const t13Records = new Map(recordsBySource);
    t13Records.set('COPQ_DASHBOARD_SHEET', [record('2026-06-02', {
      copqValue: '620461.4592',
      copqBeforeQaClearance: '620461.4592',
      qaSavedAmount: '211008.8452771799',
      sourceCell: 'T13',
    })]);
    const result = getCalculator('COPQ')!.calculate({ recordsBySource: t13Records });
    expect(result.status).toBe(KpiStatus.UNAVAILABLE);
  });

  it('returns unavailable for zero denominator ratios', () => {
    const emptyHrCost = new Map(recordsBySource);
    emptyHrCost.set('HR_COST_SHEET', [record('2026-06-01', { hrCost: '0' })]);
    const result = getCalculator('REVENUE_HR_COST_RATIO')!.calculate({
      recordsBySource: emptyHrCost,
      snapshotContext: snapshotContext(),
    });
    expect(result.status).toBe(KpiStatus.UNAVAILABLE);
  });
});
