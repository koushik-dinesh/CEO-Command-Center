import type { RowDataPacket } from 'mysql2';
import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
import {
  calendarMonthStart,
  calculateCopqPeriodTotals,
  financialQuarterStartDate,
} from './copqPeriods.js';
import { financialYearStartDate } from '../command-center/inventoryDays.js';
import { getLatestCopqStagingRecord } from './copqStagingQueries.js';
import { parseNcCopqRecords, type NcCopqAnalyticsRecord } from './ncRecords.js';

interface DataSourceDbRow extends RowDataPacket {
  configJson: unknown;
}

export interface CopqCategoryBreakdownRow {
  category: string;
  mtd: number;
  qtd: number;
  ytd: number;
  pctOfTotal: number;
}

export interface CopqTopContributorRow {
  ncNumber: string;
  date: string;
  product: string;
  department: string;
  rootCause: string;
  finalCopq: number;
  status: string;
}

export interface CopqDepartmentRow {
  department: string;
  ncCount: number;
  totalCopq: number;
  avgCopq: number;
  pctContribution: number;
}

export interface CopqProductRow {
  product: string;
  ncCount: number;
  totalCopq: number;
}

export interface CopqMonthlyTrendRow {
  month: string;
  monthLabel: string;
  copq: number;
  qaSaved: number | null;
  beforeQaClearance: number | null;
}

export interface CopqDrilldownAnalytics {
  categoryBreakdown: CopqCategoryBreakdownRow[];
  topContributors: CopqTopContributorRow[];
  byDepartment: CopqDepartmentRow[];
  byProduct: CopqProductRow[];
  monthlyTrend: CopqMonthlyTrendRow[];
}

export interface NcAnalyticsContext {
  records: NcCopqAnalyticsRecord[];
  referenceDate: string;
  financialYearStart: string;
  monthStart: string;
  quarterStart: string;
  sheetName: string | null;
  sourceWorkbook: string | null;
  lastUpdated: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

function isWithinInclusive(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

function sumCopq(records: NcCopqAnalyticsRecord[]): number {
  return records.reduce((sum, record) => sum + record.finalCopq, 0);
}

function roundCurrency(value: number): number {
  return Number(value.toFixed(2));
}

function pctOf(value: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function monthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

function monthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number);
  if (!year || !monthNum) return month;
  return new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

function aggregateByField(
  records: NcCopqAnalyticsRecord[],
  field: keyof Pick<NcCopqAnalyticsRecord, 'category' | 'department' | 'product'>,
): Map<string, NcCopqAnalyticsRecord[]> {
  const map = new Map<string, NcCopqAnalyticsRecord[]>();
  for (const record of records) {
    const key = record[field];
    const bucket = map.get(key) ?? [];
    bucket.push(record);
    map.set(key, bucket);
  }
  return map;
}

export function buildCopqDrilldownAnalytics(
  records: NcCopqAnalyticsRecord[],
  referenceDate: string,
  totalCopqYtd: number | null,
): CopqDrilldownAnalytics {
  const monthStart = calendarMonthStart(referenceDate);
  const quarterStart = financialQuarterStartDate(referenceDate);
  const financialYearStart = financialYearStartDate(referenceDate);
  const referenceKey = referenceDate.slice(0, 10);

  const mtdRecords = monthStart
    ? records.filter((record) => isWithinInclusive(record.ncDate, monthStart, referenceKey))
    : [];
  const qtdRecords = quarterStart
    ? records.filter((record) => isWithinInclusive(record.ncDate, quarterStart, referenceKey))
    : [];
  const ytdRecords = financialYearStart
    ? records.filter((record) => isWithinInclusive(record.ncDate, financialYearStart, referenceKey))
    : records;

  const denominator = totalCopqYtd ?? sumCopq(ytdRecords);

  const categoryKeys = new Set<string>();
  for (const record of records) categoryKeys.add(record.category);

  const categoryBreakdown = [...categoryKeys]
    .map((category) => {
      const mtd = sumCopq(mtdRecords.filter((record) => record.category === category));
      const qtd = sumCopq(qtdRecords.filter((record) => record.category === category));
      const ytd = sumCopq(ytdRecords.filter((record) => record.category === category));
      return {
        category,
        mtd: roundCurrency(mtd),
        qtd: roundCurrency(qtd),
        ytd: roundCurrency(ytd),
        pctOfTotal: pctOf(ytd, denominator),
      };
    })
    .filter((row) => row.ytd > 0 || row.qtd > 0 || row.mtd > 0)
    .sort((a, b) => b.ytd - a.ytd);

  const topContributors = [...records]
    .sort((a, b) => b.finalCopq - a.finalCopq)
    .slice(0, 10)
    .map((record) => ({
      ncNumber: record.ncNumber,
      date: record.displayDate,
      product: record.product,
      department: record.department,
      rootCause: record.rootCause,
      finalCopq: roundCurrency(record.finalCopq),
      status: record.status,
    }));

  const byDepartment = [...aggregateByField(ytdRecords, 'department').entries()]
    .map(([department, deptRecords]) => {
      const totalCopq = sumCopq(deptRecords);
      return {
        department,
        ncCount: deptRecords.length,
        totalCopq: roundCurrency(totalCopq),
        avgCopq: deptRecords.length > 0 ? roundCurrency(totalCopq / deptRecords.length) : 0,
        pctContribution: pctOf(totalCopq, denominator),
      };
    })
    .sort((a, b) => b.totalCopq - a.totalCopq);

  const byProduct = [...aggregateByField(ytdRecords, 'product').entries()]
    .map(([product, productRecords]) => ({
      product,
      ncCount: productRecords.length,
      totalCopq: roundCurrency(sumCopq(productRecords)),
    }))
    .sort((a, b) => b.totalCopq - a.totalCopq);

  const monthlyMap = new Map<string, NcCopqAnalyticsRecord[]>();
  for (const record of records) {
    const key = monthKey(record.ncDate);
    const bucket = monthlyMap.get(key) ?? [];
    bucket.push(record);
    monthlyMap.set(key, bucket);
  }

  const monthlyTrend = [...monthlyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, monthRecords]) => {
      const copq = sumCopq(monthRecords);
      const beforeQaClearance = monthRecords.reduce((sum, record) => {
        const before = record.beforeQaCopq ?? record.finalCopq;
        return sum + before;
      }, 0);
      const qaSaved = monthRecords.reduce((sum, record) => {
        if (record.beforeQaCopq == null) return sum;
        return sum + Math.max(0, record.beforeQaCopq - record.finalCopq);
      }, 0);
      const hasBeforeQa = monthRecords.some((record) => record.beforeQaCopq != null);

      return {
        month,
        monthLabel: monthLabel(month),
        copq: roundCurrency(copq),
        qaSaved: hasBeforeQa ? roundCurrency(qaSaved) : null,
        beforeQaClearance: hasBeforeQa ? roundCurrency(beforeQaClearance) : null,
      };
    });

  return {
    categoryBreakdown,
    topContributors,
    byDepartment,
    byProduct,
    monthlyTrend,
  };
}

export async function loadNcAnalyticsContext(metadata: unknown): Promise<NcAnalyticsContext | null> {
  const staging = await getLatestCopqStagingRecord();
  if (!staging) return null;

  const normalized = asRecord(staging.normalized);
  const raw = asRecord(staging.raw);
  const ncRecords = raw.ncRecords as { sheetName?: string; values?: unknown[][] } | undefined;
  if (!ncRecords?.values?.length) return null;

  const dataSource = await queryOne<DataSourceDbRow>(
    `SELECT configJson FROM data_sources WHERE code = 'COPQ_DASHBOARD_SHEET' LIMIT 1`,
  );
  const config = dataSource ? asRecord(parseJsonField(dataSource.configJson)) : {};
  const referenceDate = metadataString(metadata, 'copqReferenceDate')
    ?? metadataString(normalized, 'copqReferenceDate')
    ?? new Date().toISOString().slice(0, 10);

  const parsed = parseNcCopqRecords(ncRecords.values, {
    copqColumn: String(config.ncCopqColumn ?? 'FINAL COPQ'),
    dateColumn: String(config.ncDateColumn ?? 'NC DATE'),
    dateColumnFallbacks: Array.isArray(config.ncDateColumnFallbacks)
      ? config.ncDateColumnFallbacks.map(String)
      : ['Timestamp', 'Date'],
    sourceKeyColumn: String(config.ncSourceKeyColumn ?? 'QC NC number'),
    ncNumberColumn: String(config.ncNumberColumn ?? 'QC NC number'),
    productColumn: String(config.productColumn ?? 'Product name'),
    departmentColumn: String(config.departmentColumn ?? 'QC Location'),
    rootCauseColumn: String(config.rootCauseColumn ?? 'Reason For Rejection'),
    rootCauseFallbackColumn: String(config.rootCauseFallbackColumn ?? 'Complaint name'),
    categoryColumn: String(config.categoryColumn ?? 'Issue Related to'),
    statusColumn: String(config.statusColumn ?? 'Status'),
    beforeQaCopqColumn: String(config.beforeQaCopqColumn ?? 'QC COPQ'),
  });

  const totals = calculateCopqPeriodTotals(parsed.records, referenceDate);
  const financialYearStart = totals?.financialYearStart
    ?? financialYearStartDate(referenceDate)
    ?? referenceDate.slice(0, 10);

  return {
    records: parsed.records,
    referenceDate: referenceDate.slice(0, 10),
    financialYearStart,
    monthStart: totals?.monthStart ?? calendarMonthStart(referenceDate) ?? referenceDate.slice(0, 10),
    quarterStart: totals?.quarterStart ?? financialQuarterStartDate(referenceDate) ?? referenceDate.slice(0, 10),
    sheetName: metadataString(metadata, 'ncRecordsSheetName')
      ?? ncRecords.sheetName
      ?? String(config.ncRecordsSheetName ?? 'Form Responses 1'),
    sourceWorkbook: metadataString(metadata, 'sourceWorkbookName')
      ?? metadataString(normalized, 'sourceWorkbookName'),
    lastUpdated: metadataString(metadata, 'sourceLastUpdatedAt')
      ?? metadataString(normalized, 'sourceLastUpdatedAt'),
  };
}
