import { extractRevenuePeriods } from '../command-center/insights.js';
import type { MetricTrendPoint, KpiMetric } from '../command-center/types.js';
import { buildKpi } from '../command-center/insights.js';
import { HrExpenseRepository } from '../repositories/HrExpenseRepository.js';
import { PbtMonthlyInputRepository, type PbtMonthlyInputRow } from '../repositories/PbtMonthlyInputRepository.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import type { RevenueVsCogsPayload } from '../reports/types.js';
import { REQUIRED_SNAPSHOT_REPORT_COUNT } from '../snapshots/snapshotCompleteness.js';
import { queryOne } from '../db/mysql.js';
import type { RowDataPacket } from 'mysql2';

export interface PbtCalculatedRecord {
  id: string | null;
  month: number;
  year: number;
  monthLabel: string;
  revenue: number | null;
  directExpense: number | null;
  hrExpense: number | null;
  additionalIndirectExpense: number | null;
  indirectExpense: number | null;
  profitBeforeTax: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PbtIntelligence {
  revenue: number | null;
  directExpense: number | null;
  hrExpense: number | null;
  additionalIndirectExpense: number | null;
  indirectExpense: number | null;
  profitBeforeTax: number | null;
  trend: Array<{
    monthLabel: string;
    month: number;
    year: number;
    revenue: number | null;
    directExpense: number | null;
    hrExpense: number | null;
    additionalIndirectExpense: number | null;
    indirectExpense: number | null;
    profitBeforeTax: number | null;
  }>;
  records: PbtCalculatedRecord[];
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthLabel(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1] ?? `Month ${month}`;
  return `${name} ${year}`;
}

export function computeTotalIndirectExpense(
  hrExpense: number | null,
  additionalIndirectExpense: number | null,
): number {
  return (hrExpense ?? 0) + (additionalIndirectExpense ?? 0);
}

export function calculatePbt(
  revenue: number | null,
  directExpense: number | null,
  totalIndirectExpense: number | null,
): number | null {
  if (revenue === null || directExpense === null || totalIndirectExpense === null) return null;
  return revenue - (directExpense + totalIndirectExpense);
}

async function getHrExpenseForMonth(month: number, year: number): Promise<number | null> {
  const row = await HrExpenseRepository.findByCalendarMonth(month, year);
  return row?.hrExpense ?? null;
}

export function validateExpenseValue(value: unknown, fieldName: string): number {
  if (typeof value === 'string' && value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (parsed < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  return parsed;
}

export function validateMonthYear(month: unknown, year: unknown): { month: number; year: number } {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error('Month must be between 1 and 12');
  }
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new Error('Year must be between 2000 and 2100');
  }
  return { month: m, year: y };
}

async function getRevenueForMonth(month: number, year: number): Promise<number | null> {
  const row = await queryOne<RowDataPacket & { payloadJson: unknown }>(
    `SELECT rs.payloadJson
     FROM report_snapshots rs
     INNER JOIN (
       SELECT snapshotKey
       FROM report_snapshots
       GROUP BY snapshotKey
       HAVING COUNT(DISTINCT reportType) = ${REQUIRED_SNAPSHOT_REPORT_COUNT}
     ) complete ON complete.snapshotKey = rs.snapshotKey
     WHERE rs.reportType = 'REVENUE_VS_COGS'
       AND YEAR(rs.snapshotDate) = ?
       AND MONTH(rs.snapshotDate) = ?
     ORDER BY rs.snapshotTimestamp DESC
     LIMIT 1`,
    [year, month],
  );

  if (!row) return null;

  let payload: RevenueVsCogsPayload | null = null;
  if (typeof row.payloadJson === 'string') {
    try {
      payload = JSON.parse(row.payloadJson) as RevenueVsCogsPayload;
    } catch {
      return null;
    }
  } else if (row.payloadJson && typeof row.payloadJson === 'object') {
    payload = row.payloadJson as RevenueVsCogsPayload;
  }

  if (!payload) return null;

  const periods = extractRevenuePeriods({
    revenueVsCogs: payload,
    salesperson: null,
    customerGroup: null,
    productGroup: null,
  });

  return periods.revenueMTD ?? payload.total?.mtdRevenue ?? null;
}

async function toCalculatedRecord(
  input: PbtMonthlyInputRow | null,
  month: number,
  year: number,
  revenue: number | null,
): Promise<PbtCalculatedRecord> {
  const direct = input?.directExpense ?? null;
  const hrExpense = await getHrExpenseForMonth(month, year);
  const additionalIndirectExpense = input?.indirectExpense ?? null;
  const totalIndirect = input
    ? computeTotalIndirectExpense(hrExpense, additionalIndirectExpense)
    : (hrExpense === null ? null : computeTotalIndirectExpense(hrExpense, 0));

  return {
    id: input?.id ?? null,
    month,
    year,
    monthLabel: monthLabel(month, year),
    revenue,
    directExpense: direct,
    hrExpense,
    additionalIndirectExpense,
    indirectExpense: totalIndirect,
    profitBeforeTax: calculatePbt(revenue, direct, input ? totalIndirect : null),
    createdAt: input?.createdAt.toISOString() ?? null,
    updatedAt: input?.updatedAt.toISOString() ?? null,
  };
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function generatePbtInsights(records: PbtCalculatedRecord[]): PbtIntelligence['insights'] {
  const insights: PbtIntelligence['insights'] = [];
  if (records.length < 2) return insights;

  const sorted = [...records].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  const current = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  const directChange = pctChange(current.directExpense, previous.directExpense);
  if (directChange !== null && Math.abs(directChange) >= 0.5) {
    insights.push({
      id: 'direct-expense-change',
      severity: directChange > 0 ? 'warning' : 'positive',
      message: `Direct expenses ${directChange > 0 ? 'increased' : 'decreased'} ${Math.abs(directChange).toFixed(0)}% compared to last month.`,
    });
  }

  const indirectChange = pctChange(current.indirectExpense, previous.indirectExpense);
  if (indirectChange !== null && Math.abs(indirectChange) >= 0.5) {
    const trending = indirectChange > 5 ? 'trending upward' : indirectChange < -5 ? 'trending downward' : `${indirectChange > 0 ? 'increased' : 'decreased'} ${Math.abs(indirectChange).toFixed(0)}%`;
    insights.push({
      id: 'indirect-expense-change',
      severity: indirectChange > 0 ? 'warning' : 'positive',
      message: indirectChange > 5 || indirectChange < -5
        ? `Indirect expenses are ${trending}.`
        : `Indirect expenses ${indirectChange > 0 ? 'increased' : 'decreased'} ${Math.abs(indirectChange).toFixed(0)}% compared to last month.`,
    });
  }

  const pbtChange = pctChange(current.profitBeforeTax, previous.profitBeforeTax);
  if (pbtChange !== null && Math.abs(pbtChange) >= 0.5) {
    insights.push({
      id: 'pbt-change',
      severity: pbtChange > 0 ? 'positive' : 'negative',
      message: `PBT ${pbtChange > 0 ? 'improved' : 'declined'} by ${Math.abs(pbtChange).toFixed(0)}%.`,
    });
  }

  if (current.profitBeforeTax !== null && current.profitBeforeTax < 0) {
    insights.push({
      id: 'pbt-negative',
      severity: 'negative',
      message: 'Profit Before Tax is negative for the latest period — review expense controls.',
    });
  }

  const revenueChange = pctChange(current.revenue, previous.revenue);
  if (revenueChange !== null && Math.abs(revenueChange) >= 1) {
    insights.push({
      id: 'revenue-change',
      severity: revenueChange > 0 ? 'positive' : 'warning',
      message: `Revenue ${revenueChange > 0 ? 'grew' : 'declined'} ${Math.abs(revenueChange).toFixed(0)}% versus the prior month.`,
    });
  }

  return insights.slice(0, 5);
}

function pbtHealth(value: number | null, changePercent: number | null): KpiMetric['health'] {
  if (value === null) return 'neutral';
  if (value < 0) return 'critical';
  if (changePercent !== null && changePercent < -5) return 'warning';
  if (value > 0 && (changePercent === null || changePercent >= 0)) return 'good';
  return 'neutral';
}

export class PbtService {
  async getRevenueForMonth(month: number, year: number): Promise<number | null> {
    return getRevenueForMonth(month, year);
  }

  async getByMonthYear(month: number, year: number): Promise<PbtCalculatedRecord> {
    const input = await PbtMonthlyInputRepository.findByMonthYear(month, year);
    const revenue = await getRevenueForMonth(month, year);
    return toCalculatedRecord(input, month, year, revenue);
  }

  async getHrExpenseForMonth(month: number, year: number): Promise<number | null> {
    return getHrExpenseForMonth(month, year);
  }

  async listHistorical(): Promise<PbtCalculatedRecord[]> {
    const inputs = await PbtMonthlyInputRepository.listAll();
    const records = await Promise.all(
      inputs.map(async (input) => {
        const revenue = await getRevenueForMonth(input.month, input.year);
        return toCalculatedRecord(input, input.month, input.year, revenue);
      }),
    );
    return records;
  }

  async listCalculated(): Promise<PbtCalculatedRecord[]> {
    const inputs = await PbtMonthlyInputRepository.listAll();
    if (inputs.length === 0) return [];

    const minYear = Math.min(...inputs.map((i) => i.year));
    const maxYear = Math.max(...inputs.map((i) => i.year));
    const inputByKey = new Map(inputs.map((i) => [`${i.year}-${i.month}`, i]));

    const records: PbtCalculatedRecord[] = [];
    for (let year = minYear; year <= maxYear; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const key = `${year}-${month}`;
        const input = inputByKey.get(key) ?? null;
        if (!input) continue;
        const revenue = await getRevenueForMonth(month, year);
        records.push(await toCalculatedRecord(input, month, year, revenue));
      }
    }

    return records.sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  }

  async createInput(
    userId: string,
    month: number,
    year: number,
    directExpense: number,
    additionalIndirectExpense: number,
  ): Promise<PbtCalculatedRecord> {
    const existing = await PbtMonthlyInputRepository.findByMonthYear(month, year);
    if (existing) {
      throw Object.assign(new Error('A record already exists for this month and year. Use update instead.'), { statusCode: 409 });
    }

    const input = await PbtMonthlyInputRepository.create({
      month,
      year,
      directExpense,
      indirectExpense: additionalIndirectExpense,
      createdBy: userId,
    });
    const revenue = await getRevenueForMonth(month, year);
    return toCalculatedRecord(input, month, year, revenue);
  }

  async updateInput(
    month: number,
    year: number,
    directExpense: number,
    additionalIndirectExpense: number,
  ): Promise<PbtCalculatedRecord> {
    const existing = await PbtMonthlyInputRepository.findByMonthYear(month, year);
    if (!existing) {
      throw Object.assign(new Error('No record found for this month and year.'), { statusCode: 404 });
    }

    const input = await PbtMonthlyInputRepository.update(existing.id, {
      directExpense,
      indirectExpense: additionalIndirectExpense,
    });
    const revenue = await getRevenueForMonth(month, year);
    return toCalculatedRecord(input, month, year, revenue);
  }

  async buildIntelligence(): Promise<PbtIntelligence> {
    const records = await this.listCalculated();
    const sorted = [...records].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

    const latest = sorted[sorted.length - 1] ?? null;
    const trend = sorted.map((record) => ({
      monthLabel: record.monthLabel,
      month: record.month,
      year: record.year,
      revenue: record.revenue,
      directExpense: record.directExpense,
      hrExpense: record.hrExpense,
      additionalIndirectExpense: record.additionalIndirectExpense,
      indirectExpense: record.indirectExpense,
      profitBeforeTax: record.profitBeforeTax,
    }));

    return {
      revenue: latest?.revenue ?? null,
      directExpense: latest?.directExpense ?? null,
      hrExpense: latest?.hrExpense ?? null,
      additionalIndirectExpense: latest?.additionalIndirectExpense ?? null,
      indirectExpense: latest?.indirectExpense ?? null,
      profitBeforeTax: latest?.profitBeforeTax ?? null,
      trend,
      records: sorted.slice().reverse(),
      insights: generatePbtInsights(sorted),
    };
  }

  async buildKpi(): Promise<KpiMetric | null> {
    const latestInput = await PbtMonthlyInputRepository.findLatest();
    if (!latestInput) {
      return buildKpi(
        'pbt',
        'Profit Before Tax',
        null,
        null,
        'currency',
        [],
        'neutral',
        [
          { key: 'direct', label: 'Direct', value: null, unit: 'currency', role: 'pill' },
          { key: 'indirect', label: 'Indirect', value: null, unit: 'currency', role: 'pill' },
        ],
        { healthFromTrend: false },
      );
    }

    const records = await this.listCalculated();
    const sorted = [...records].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

    const history: MetricTrendPoint[] = sorted.map((record) => ({
      snapshotKey: `${record.year}${String(record.month).padStart(2, '0')}`,
      snapshotDate: `${record.year}-${String(record.month).padStart(2, '0')}-01`,
      value: record.profitBeforeTax ?? 0,
    }));

    const changePercent = pctChange(latest?.profitBeforeTax ?? null, previous?.profitBeforeTax ?? null);

    const kpi = buildKpi(
      'pbt',
      'Profit Before Tax',
      latest?.profitBeforeTax ?? null,
      previous?.profitBeforeTax ?? null,
      'currency',
      history,
      pbtHealth(latest?.profitBeforeTax ?? null, changePercent),
      [
        { key: 'direct', label: 'Direct', value: latest?.directExpense ?? null, unit: 'currency', role: 'pill' },
        { key: 'indirect', label: 'Indirect', value: latest?.indirectExpense ?? null, unit: 'currency', role: 'pill' },
      ],
      { healthFromTrend: false },
    );

    return { ...kpi, drilldownPath: '/intelligence/profit-before-tax' };
  }

  async getCurrentSnapshotRevenue(): Promise<number | null> {
    const batch = await ReportSnapshotRepository.getLatestBatch();
    const cogsRow = batch.find((row) => row.reportType === 'REVENUE_VS_COGS');
    if (!cogsRow) return null;
    const payload = cogsRow.payloadJson as RevenueVsCogsPayload;
    const periods = extractRevenuePeriods({
      revenueVsCogs: payload,
      salesperson: null,
      customerGroup: null,
      productGroup: null,
    });
    return periods.revenueMTD ?? periods.revenueYTD ?? null;
  }
}
