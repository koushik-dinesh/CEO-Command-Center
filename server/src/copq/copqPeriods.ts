import { Decimal } from 'decimal.js';
import { financialYearStartDate, parseSnapshotDate } from '../command-center/inventoryDays.js';
import type { NcCopqRecord } from './ncRecords.js';

export interface CopqPeriodTotals {
  copqMtd: number;
  copqQtd: number;
  referenceDate: string;
  financialYearStart: string;
  quarterStart: string;
  monthStart: string;
  mtdRowCount: number;
  qtdRowCount: number;
  fyRowCount: number;
  mtdSourceKeys: string[];
  qtdSourceKeys: string[];
  fySourceKeys: string[];
}

export function calendarMonthStart(referenceDate: unknown): string | null {
  const snapshot = parseSnapshotDate(referenceDate);
  if (!snapshot) return null;
  const year = snapshot.getUTCFullYear();
  const month = String(snapshot.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/** Financial quarter start (April–June Q1, July–Sep Q2, Oct–Dec Q3, Jan–Mar Q4). */
export function financialQuarterStartDate(referenceDate: unknown): string | null {
  const snapshot = parseSnapshotDate(referenceDate);
  if (!snapshot) return null;
  const month = snapshot.getUTCMonth();
  const year = snapshot.getUTCFullYear();
  if (month >= 3 && month <= 5) return `${year}-04-01`;
  if (month >= 6 && month <= 8) return `${year}-07-01`;
  if (month >= 9 && month <= 11) return `${year}-10-01`;
  return `${year}-01-01`;
}

function isWithinInclusive(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

function sumRecords(records: NcCopqRecord[]): { total: Decimal; keys: string[] } {
  return records.reduce(
    (acc, record) => ({
      total: acc.total.plus(record.finalCopq),
      keys: [...acc.keys, record.sourceKey],
    }),
    { total: new Decimal(0), keys: [] as string[] },
  );
}

export function calculateCopqPeriodTotals(
  records: NcCopqRecord[],
  referenceDate: string,
): CopqPeriodTotals | null {
  const monthStart = calendarMonthStart(referenceDate);
  const quarterStart = financialQuarterStartDate(referenceDate);
  const financialYearStart = financialYearStartDate(referenceDate);
  const referenceKey = typeof referenceDate === 'string' && referenceDate.length >= 10
    ? referenceDate.slice(0, 10)
    : null;

  if (!monthStart || !quarterStart || !financialYearStart || !referenceKey) {
    return null;
  }

  const mtdMatches = records.filter((record) => isWithinInclusive(record.ncDate, monthStart, referenceKey));
  const qtdMatches = records.filter((record) => isWithinInclusive(record.ncDate, quarterStart, referenceKey));
  const fyMatches = records.filter((record) => isWithinInclusive(record.ncDate, financialYearStart, referenceKey));

  const mtd = sumRecords(mtdMatches);
  const qtd = sumRecords(qtdMatches);
  const fy = sumRecords(fyMatches);

  return {
    copqMtd: mtd.total.toDecimalPlaces(4).toNumber(),
    copqQtd: qtd.total.toDecimalPlaces(4).toNumber(),
    referenceDate: referenceKey,
    financialYearStart,
    quarterStart,
    monthStart,
    mtdRowCount: mtdMatches.length,
    qtdRowCount: qtdMatches.length,
    fyRowCount: fyMatches.length,
    mtdSourceKeys: mtd.keys,
    qtdSourceKeys: qtd.keys,
    fySourceKeys: fy.keys,
  };
}
