import { extractRevenuePeriods } from '../command-center/insights.js';
import { buildKpi } from '../command-center/insights.js';
import type { KpiMetric, MetricTrendPoint } from '../command-center/types.js';
import type { RevenueVsCogsPayload } from '../reports/types.js';
import { HrExpenseRepository, type HrExpenseRow } from '../repositories/HrExpenseRepository.js';
import { getRevenueForMonth } from './revenueByMonth.js';
import {
  calculateProductivityIndex,
  financialYearFromCalendar,
  financialYearLabel,
  monthShortLabel,
  monthsForMtd,
  monthsForQtd,
  monthsForYtd,
  referenceDateFromSnapshot,
  sumHrExpenses,
} from './productivityUtils.js';

export interface HrExpenseRecord {
  id: string;
  financialYear: number;
  financialYearLabel: string;
  month: number;
  calendarYear: number;
  monthLabel: string;
  hrExpense: number;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string | null;
}

export interface ProductivityIntelligence {
  summary: {
    productivityIndex: number | null;
    revenue: number | null;
    hrExpense: number | null;
    revenueYtd: number | null;
    revenueQtd: number | null;
    revenueMtd: number | null;
    hrExpenseYtd: number | null;
    hrExpenseQtd: number | null;
    hrExpenseMtd: number | null;
    productivityYtd: number | null;
    productivityQtd: number | null;
    productivityMtd: number | null;
    referenceDate: string | null;
  };
  trend: Array<{
    monthLabel: string;
    month: number;
    calendarYear: number;
    revenue: number | null;
    hrExpense: number | null;
    productivityIndex: number | null;
  }>;
  hrExpenses: HrExpenseRecord[];
  dataSources: Array<{
    key: string;
    name: string;
    purpose: string;
    refreshType: string;
  }>;
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
}

function toHrExpenseRecord(row: HrExpenseRow): HrExpenseRecord {
  return {
    id: row.id,
    financialYear: row.financialYear,
    financialYearLabel: financialYearLabel(row.financialYear),
    month: row.month,
    calendarYear: row.calendarYear,
    monthLabel: monthShortLabel(row.month, row.calendarYear),
    hrExpense: row.hrExpense,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    updatedByName: row.updatedByName ?? row.updatedByEmail,
  };
}

function buildSubMetrics(periods: {
  productivityYtd: number | null;
  productivityQtd: number | null;
  productivityMtd: number | null;
}): KpiMetric['subMetrics'] {
  return [
    { key: 'ytd', label: 'YTD', value: periods.productivityYtd, unit: 'ratio', role: 'headline-tag' },
    { key: 'qtd', label: 'QTD', value: periods.productivityQtd, unit: 'ratio', role: 'pill' },
    { key: 'mtd', label: 'MTD', value: periods.productivityMtd, unit: 'ratio', role: 'pill' },
  ];
}

function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function generateInsights(
  current: number | null,
  previous: number | null,
  revenueYtd: number | null,
  hrExpenseYtd: number | null,
): ProductivityIntelligence['insights'] {
  const insights: ProductivityIntelligence['insights'] = [];

  if (current === null) {
    insights.push({
      id: 'missing-hr-expense',
      severity: 'warning',
      message: 'Add monthly HR expense entries to calculate the Productivity Index.',
    });
    return insights;
  }

  const change = pctChange(current, previous);
  if (change !== null && Math.abs(change) >= 0.5) {
    insights.push({
      id: 'productivity-change',
      severity: change > 0 ? 'positive' : 'negative',
      message: `Productivity Index ${change > 0 ? 'improved' : 'declined'} by ${Math.abs(change).toFixed(1)}% versus the previous snapshot.`,
    });
  }

  if (revenueYtd !== null && hrExpenseYtd !== null && hrExpenseYtd > 0) {
    insights.push({
      id: 'productivity-formula',
      severity: 'neutral',
      message: `YTD productivity is ${current.toFixed(2)}× (Revenue ₹${revenueYtd.toLocaleString('en-IN')} ÷ HR Expense ₹${hrExpenseYtd.toLocaleString('en-IN')}).`,
    });
  }

  return insights.slice(0, 4);
}

export class ProductivityService {
  async listHrExpenses(): Promise<HrExpenseRecord[]> {
    const rows = await HrExpenseRepository.listAll();
    return rows.map(toHrExpenseRecord);
  }

  async createHrExpense(
    userId: string,
    month: number,
    calendarYear: number,
    hrExpense: number,
  ): Promise<HrExpenseRecord> {
    const existing = await HrExpenseRepository.findByCalendarMonth(month, calendarYear);
    if (existing) {
      throw Object.assign(new Error('HR expense already exists for this month. Use update instead.'), { statusCode: 409 });
    }

    const row = await HrExpenseRepository.create({
      financialYear: financialYearFromCalendar(calendarYear, month),
      month,
      calendarYear,
      hrExpense,
      updatedBy: userId,
    });
    return toHrExpenseRecord(row);
  }

  async updateHrExpense(
    userId: string,
    month: number,
    calendarYear: number,
    hrExpense: number,
  ): Promise<HrExpenseRecord> {
    const existing = await HrExpenseRepository.findByCalendarMonth(month, calendarYear);
    if (!existing) {
      throw Object.assign(new Error('No HR expense found for this month.'), { statusCode: 404 });
    }

    const row = await HrExpenseRepository.update(existing.id, hrExpense, userId);
    return toHrExpenseRecord(row);
  }

  async deleteHrExpense(month: number, calendarYear: number): Promise<void> {
    const deleted = await HrExpenseRepository.deleteByCalendarMonth(month, calendarYear);
    if (!deleted) {
      throw Object.assign(new Error('No HR expense found for this month.'), { statusCode: 404 });
    }
  }

  async upsertHrExpense(
    userId: string,
    month: number,
    calendarYear: number,
    hrExpense: number,
  ): Promise<HrExpenseRecord> {
    const existing = await HrExpenseRepository.findByCalendarMonth(month, calendarYear);
    if (existing) {
      return this.updateHrExpense(userId, month, calendarYear, hrExpense);
    }
    return this.createHrExpense(userId, month, calendarYear, hrExpense);
  }

  async computePeriodMetrics(
    referenceDate: string,
    revenuePayload: RevenueVsCogsPayload | null,
    hrRecords: HrExpenseRow[],
  ) {
    const revenuePeriods = extractRevenuePeriods({
      revenueVsCogs: revenuePayload,
      salesperson: null,
      customerGroup: null,
      productGroup: null,
    });

    const hrExpenseYtd = sumHrExpenses(hrRecords, monthsForYtd(referenceDate));
    const hrExpenseQtd = sumHrExpenses(hrRecords, monthsForQtd(referenceDate));
    const hrExpenseMtd = sumHrExpenses(hrRecords, monthsForMtd(referenceDate));

    const productivityYtd = calculateProductivityIndex(revenuePeriods.revenueYTD, hrExpenseYtd);
    const productivityQtd = calculateProductivityIndex(revenuePeriods.revenueQTD, hrExpenseQtd);
    const productivityMtd = calculateProductivityIndex(revenuePeriods.revenueMTD, hrExpenseMtd);

    return {
      revenueYtd: revenuePeriods.revenueYTD,
      revenueQtd: revenuePeriods.revenueQTD,
      revenueMtd: revenuePeriods.revenueMTD,
      hrExpenseYtd,
      hrExpenseQtd,
      hrExpenseMtd,
      productivityYtd,
      productivityQtd,
      productivityMtd,
    };
  }

  async buildMonthlyTrend(hrRecords: HrExpenseRow[]): Promise<ProductivityIntelligence['trend']> {
    const sorted = [...hrRecords].sort((a, b) => {
      if (a.calendarYear !== b.calendarYear) return a.calendarYear - b.calendarYear;
      return a.month - b.month;
    });

    const trend: ProductivityIntelligence['trend'] = [];
    for (const record of sorted) {
      const revenue = await getRevenueForMonth(record.month, record.calendarYear);
      trend.push({
        monthLabel: monthShortLabel(record.month, record.calendarYear),
        month: record.month,
        calendarYear: record.calendarYear,
        revenue,
        hrExpense: record.hrExpense,
        productivityIndex: calculateProductivityIndex(revenue, record.hrExpense),
      });
    }
    return trend;
  }

  async buildIntelligence(input: {
    snapshotDate: string;
    revenuePayload: RevenueVsCogsPayload | null;
    previousSnapshotDate?: string | null;
    previousRevenuePayload?: RevenueVsCogsPayload | null;
  }): Promise<ProductivityIntelligence> {
    const hrRecords = await HrExpenseRepository.listAll();
    const referenceDate = referenceDateFromSnapshot(input.snapshotDate) ?? input.snapshotDate.slice(0, 10);
    const current = await this.computePeriodMetrics(referenceDate, input.revenuePayload, hrRecords);

    const previousReference = input.previousSnapshotDate
      ? referenceDateFromSnapshot(input.previousSnapshotDate) ?? input.previousSnapshotDate.slice(0, 10)
      : null;
    const previous = previousReference
      ? await this.computePeriodMetrics(previousReference, input.previousRevenuePayload ?? null, hrRecords)
      : null;

    const trend = await this.buildMonthlyTrend(hrRecords);

    return {
      summary: {
        productivityIndex: current.productivityYtd,
        revenue: current.revenueYtd,
        hrExpense: current.hrExpenseYtd,
        revenueYtd: current.revenueYtd,
        revenueQtd: current.revenueQtd,
        revenueMtd: current.revenueMtd,
        hrExpenseYtd: current.hrExpenseYtd,
        hrExpenseQtd: current.hrExpenseQtd,
        hrExpenseMtd: current.hrExpenseMtd,
        productivityYtd: current.productivityYtd,
        productivityQtd: current.productivityQtd,
        productivityMtd: current.productivityMtd,
        referenceDate,
      },
      trend,
      hrExpenses: hrRecords.map(toHrExpenseRecord),
      dataSources: [
        {
          key: 'revenue',
          name: 'Revenue',
          purpose: 'Existing Revenue Data Source',
          refreshType: 'Snapshot sync',
        },
        {
          key: 'hrExpense',
          name: 'HR Expense',
          purpose: 'Manual Monthly Entry',
          refreshType: 'User maintained',
        },
      ],
      insights: generateInsights(
        current.productivityYtd,
        previous?.productivityYtd ?? null,
        current.revenueYtd,
        current.hrExpenseYtd,
      ),
    };
  }

  async buildKpi(input: {
    snapshotDate: string;
    revenuePayload: RevenueVsCogsPayload | null;
    previousSnapshotDate?: string | null;
    previousRevenuePayload?: RevenueVsCogsPayload | null;
  }): Promise<KpiMetric> {
    const hrRecords = await HrExpenseRepository.listAll();
    const referenceDate = referenceDateFromSnapshot(input.snapshotDate) ?? input.snapshotDate.slice(0, 10);
    const current = await this.computePeriodMetrics(referenceDate, input.revenuePayload, hrRecords);

    const previousReference = input.previousSnapshotDate
      ? referenceDateFromSnapshot(input.previousSnapshotDate) ?? input.previousSnapshotDate.slice(0, 10)
      : null;
    const previous = previousReference
      ? await this.computePeriodMetrics(previousReference, input.previousRevenuePayload ?? null, hrRecords)
      : null;

    const trend = await this.buildMonthlyTrend(hrRecords);
    const history: MetricTrendPoint[] = trend
      .filter((point) => point.productivityIndex !== null)
      .map((point) => ({
        snapshotKey: `${point.calendarYear}${String(point.month).padStart(2, '0')}`,
        snapshotDate: `${point.calendarYear}-${String(point.month).padStart(2, '0')}-01`,
        value: point.productivityIndex!,
      }));

    const footnote = current.hrExpenseYtd === null
      ? 'Enter monthly HR expense to calculate productivity.'
      : null;

    const kpi = buildKpi(
      'productivityIndex',
      'Productivity Index',
      current.productivityYtd,
      previous?.productivityYtd ?? null,
      'ratio',
      history,
      undefined,
      buildSubMetrics({
        productivityYtd: current.productivityYtd,
        productivityQtd: current.productivityQtd,
        productivityMtd: current.productivityMtd,
      }),
    );

    return {
      ...kpi,
      footnote,
      drilldownPath: '/intelligence/productivity',
    };
  }
}

export function buildProductivitySummaryBullets(intelligence: ProductivityIntelligence): string[] {
  const bullets: string[] = [];
  const { summary } = intelligence;

  if (summary.productivityYtd !== null) {
    bullets.push(`YTD Productivity Index is ${summary.productivityYtd.toFixed(2)}×.`);
  } else {
    bullets.push('Add monthly HR expense entries to calculate the Productivity Index.');
  }

  if (summary.revenueYtd !== null && summary.hrExpenseYtd !== null) {
    bullets.push(`Based on Revenue ₹${summary.revenueYtd.toLocaleString('en-IN')} and HR Expense ₹${summary.hrExpenseYtd.toLocaleString('en-IN')} (YTD).`);
  }

  for (const insight of intelligence.insights.slice(0, 2)) {
    bullets.push(insight.message);
  }

  return bullets.slice(0, 4);
}
