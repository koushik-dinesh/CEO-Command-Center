import { describe, expect, it } from 'vitest';
import {
  calculateProductivityIndex,
  enumerateCalendarMonths,
  financialYearFromCalendar,
  financialYearLabel,
  monthsForMtd,
  monthsForQtd,
  monthsForYtd,
  sumHrExpenses,
  validateHrExpenseValue,
} from '../src/productivity/productivityUtils.js';
import type { HrExpenseRow } from '../src/repositories/HrExpenseRepository.js';

function hrRecord(month: number, calendarYear: number, hrExpense: number): HrExpenseRow {
  return {
    id: `hre_${calendarYear}_${month}`,
    financialYear: financialYearFromCalendar(calendarYear, month),
    month,
    calendarYear,
    hrExpense,
    updatedBy: 'user_1',
    updatedByName: 'Test User',
    updatedByEmail: 'test@example.com',
    createdAt: new Date('2026-04-01'),
    updatedAt: new Date('2026-04-01'),
  };
}

describe('productivityUtils', () => {
  it('calculates productivity index as revenue divided by HR expense', () => {
    expect(calculateProductivityIndex(2_850_000, 1_000_000)).toBe(2.85);
    expect(calculateProductivityIndex(1_000_000, 0)).toBeNull();
    expect(calculateProductivityIndex(null, 1_000_000)).toBeNull();
  });

  it('derives financial year labels from calendar month', () => {
    expect(financialYearFromCalendar(2026, 4)).toBe(2026);
    expect(financialYearFromCalendar(2027, 2)).toBe(2026);
    expect(financialYearLabel(2026)).toBe('FY 2026-27');
  });

  it('enumerates YTD, QTD, and MTD months for a June snapshot', () => {
    expect(monthsForMtd('2026-06-18')).toEqual([{ calendarYear: 2026, month: 6 }]);
    expect(monthsForYtd('2026-06-18').map((m) => `${m.calendarYear}-${m.month}`)).toEqual([
      '2026-4', '2026-5', '2026-6',
    ]);
    expect(monthsForQtd('2026-06-18').map((m) => `${m.calendarYear}-${m.month}`)).toEqual([
      '2026-4', '2026-5', '2026-6',
    ]);
  });

  it('sums HR expenses for selected months', () => {
    const records = [
      hrRecord(4, 2026, 1_250_000),
      hrRecord(5, 2026, 1_280_000),
      hrRecord(6, 2026, 1_310_000),
    ];
    const ytdMonths = monthsForYtd('2026-06-18');
    expect(sumHrExpenses(records, ytdMonths)).toBe(3_840_000);
    expect(sumHrExpenses(records, monthsForMtd('2026-06-18'))).toBe(1_310_000);
  });

  it('validates HR expense input', () => {
    expect(validateHrExpenseValue('1250000.456')).toBe(1250000.46);
    expect(() => validateHrExpenseValue(0)).toThrow(/greater than zero/);
    expect(() => validateHrExpenseValue('')).toThrow(/required/);
  });

  it('enumerates months across calendar years', () => {
    const months = enumerateCalendarMonths({ calendarYear: 2026, month: 11 }, { calendarYear: 2027, month: 2 });
    expect(months).toEqual([
      { calendarYear: 2026, month: 11 },
      { calendarYear: 2026, month: 12 },
      { calendarYear: 2027, month: 1 },
      { calendarYear: 2027, month: 2 },
    ]);
  });
});
