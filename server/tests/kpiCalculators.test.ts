import { KpiStatus } from '../src/db/types.js';
import { describe, expect, it } from 'vitest';
import { getCalculator } from '../src/kpis/registry.js';
import type { KpiSourceRecord } from '../src/kpis/types.js';

function record(date: string, normalized: Record<string, string>): KpiSourceRecord {
  return { sourceDate: new Date(date), normalized };
}

describe('KPI calculators', () => {
  const recordsBySource = new Map<string, KpiSourceRecord[]>([
    ['REVENUE_CSV', [
      record('2026-06-01', { revenueMtd: '100000', revenueQtd: '400000', revenueYtd: '250000', cogs: '140000', sourceFileName: 'Sales_Revenue_by_Customer_Group.csv' }),
      record('2026-06-02', { revenueMtd: '120000', revenueQtd: '500000', revenueYtd: '320000', cogs: '180000', sourceFileName: 'Sales_Revenue_by_Customer_Group.csv' }),
    ]],
    ['SAP_EXPORT_CSV', [record('2026-06-01', { cogs: '50000' })]],
    ['INVENTORY_CSV', [record('2026-06-01', { inventoryValue: '120000' }), record('2026-06-01', { inventoryValue: '100000' }), record('2026-06-02', { inventoryValue: '224000' })]],
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

  it('calculates revenue', () => {
    const result = getCalculator('REVENUE')!.calculate({ recordsBySource });
    expect(result.status).toBe(KpiStatus.CURRENT);
    expect(result.value?.toString()).toBe('320000');
    expect(result.metadataJson).toMatchObject({
      methodologyVersion: 'sales-revenue-customer-group-latest-file-ytd-v1',
      revenueMtd: '120000',
      revenueQtd: '500000',
      revenueYtd: '320000',
      rowsAccepted: 1,
      totalRevenueRowsAvailable: 2,
      sourceFileName: 'Sales_Revenue_by_Customer_Group.csv',
    });
  });

  it('calculates COGS across revenue and SAP sources', () => {
    const result = getCalculator('COGS')!.calculate({ recordsBySource });
    expect(result.value?.toString()).toBe('370000');
  });

  it('calculates latest inventory value', () => {
    const result = getCalculator('INVENTORY_VALUE')!.calculate({ recordsBySource });
    expect(result.value?.toString()).toBe('224000');
  });

  it('calculates COPQ', () => {
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

  it('calculates COPQ from staged copqValue when totalCopq is absent', () => {
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
    const result = getCalculator('REVENUE_HR_COST_RATIO')!.calculate({ recordsBySource: emptyHrCost });
    expect(result.status).toBe(KpiStatus.UNAVAILABLE);
  });
});
