import { describe, expect, it } from 'vitest';
import { buildCopqSubMetrics } from '../src/command-center/insights.js';
import { calculateCopqPeriodTotals, calendarMonthStart, financialQuarterStartDate } from '../src/copq/copqPeriods.js';
import { parseNcCopqRecords } from '../src/copq/ncRecords.js';

const ncValues = [
  ['Timestamp', 'NC Number', 'NC DATE', 'FINAL COPQ'],
  ['2026-04-10', 'NC-001', '2026-04-10', 100000],
  ['2026-05-15', 'NC-002', '2026-05-15', 50000],
  ['2026-06-05', 'NC-003', '2026-06-05', 30000],
  ['2026-06-12', 'NC-004', '2026-06-12', 20000],
  ['2026-03-20', 'NC-OLD', '2026-03-20', 99999],
];

describe('parseNcCopqRecords', () => {
  it('parses NC rows using NC DATE and FINAL COPQ columns', () => {
    const parsed = parseNcCopqRecords(ncValues, {
      copqColumn: 'FINAL COPQ',
      dateColumn: 'NC DATE',
      sourceKeyColumn: 'NC Number',
    });
    expect(parsed.records).toHaveLength(5);
    expect(parsed.records.map((row) => row.sourceKey)).toEqual(['NC-001', 'NC-002', 'NC-003', 'NC-004', 'NC-OLD']);
  });

  it('disambiguates duplicate NC numbers without dropping rows or changing ncNumber', () => {
    const duplicateValues = [
      ['NC DATE', 'FINAL COPQ', 'NC Number'],
      ['2026-04-10', 100000, 'NC-DUP'],
      ['2026-04-11', 50000, 'NC-DUP'],
      ['2026-04-12', 25000, 'NC-DUP'],
    ];
    const parsed = parseNcCopqRecords(duplicateValues, {
      copqColumn: 'FINAL COPQ',
      dateColumn: 'NC DATE',
      sourceKeyColumn: 'NC Number',
    });

    expect(parsed.records).toHaveLength(3);
    expect(parsed.records.map((row) => row.sourceKey)).toEqual(['NC-DUP', 'NC-DUP#2', 'NC-DUP#3']);
    expect(parsed.records.every((row) => row.ncNumber === 'NC-DUP')).toBe(true);
    expect(parsed.records.reduce((sum, row) => sum + row.finalCopq, 0)).toBe(175000);
  });
});

describe('calculateCopqPeriodTotals', () => {
  it('sums MTD and QTD from NC record dates using financial year quarter boundaries', () => {
    const parsed = parseNcCopqRecords(ncValues, {
      copqColumn: 'FINAL COPQ',
      dateColumn: 'NC DATE',
      sourceKeyColumn: 'NC Number',
    });
    const totals = calculateCopqPeriodTotals(parsed.records, '2026-06-18');
    expect(totals).not.toBeNull();
    expect(totals?.financialYearStart).toBe('2026-04-01');
    expect(totals?.quarterStart).toBe('2026-04-01');
    expect(totals?.monthStart).toBe('2026-06-01');
    expect(totals?.copqMtd).toBe(50000);
    expect(totals?.copqQtd).toBe(200000);
    expect(totals?.mtdRowCount).toBe(2);
    expect(totals?.qtdRowCount).toBe(4);
    expect(totals?.mtdSourceKeys).toEqual(['NC-003', 'NC-004']);
  });

  it('uses Jan–Mar as Q4 of the financial year', () => {
    expect(financialQuarterStartDate('2026-02-15')).toBe('2026-01-01');
    expect(calendarMonthStart('2026-02-15')).toBe('2026-02-01');
  });
});

describe('buildCopqSubMetrics', () => {
  it('shows YTD, QTD, MTD, and supporting dashboard metrics from metadata', () => {
    const subMetrics = buildCopqSubMetrics({
      copqQtd: '200000',
      copqMtd: '50000',
      copqBeforeQaClearance: '583944.0492',
      qaSavedAmount: '211008.8452',
    }, 321762.5899);
    expect(subMetrics).toEqual([
      { key: 'ytd', label: 'YTD', value: 321762.5899, unit: 'currency', role: 'headline-tag' },
      { key: 'qtd', label: 'QTD', value: 200000, unit: 'currency', role: 'pill' },
      { key: 'mtd', label: 'MTD', value: 50000, unit: 'currency', role: 'pill' },
      { key: 'beforeQa', label: 'Before QA Clearance', value: 583944.0492, unit: 'currency', role: 'pill' },
      { key: 'qaSaved', label: 'QA Saved', value: 211008.8452, unit: 'currency', role: 'pill' },
    ]);
  });
});
