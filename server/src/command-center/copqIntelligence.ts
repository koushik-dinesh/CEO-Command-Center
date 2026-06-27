import { enrichCopqMetadataFromStaging } from '../copq/copqStagingEnrichment.js';
import { buildCopqDrilldownAnalytics, loadNcAnalyticsContext } from '../copq/copqAnalytics.js';
import { resolveCopqHeadlineValue } from '../copq/copqKpiValue.js';
import { KpiRepository } from '../repositories/KpiRepository.js';

export interface CopqIntelligence {
  summary: {
    totalCopqYtd: number | null;
    copqMtd: number | null;
    copqQtd: number | null;
    qaSavedAmount: number | null;
    beforeQaClearance: number | null;
  };
  categoryBreakdown: Array<{
    category: string;
    mtd: number;
    qtd: number;
    ytd: number;
    pctOfTotal: number;
  }>;
  topContributors: Array<{
    ncNumber: string;
    date: string;
    product: string;
    department: string;
    rootCause: string;
    finalCopq: number;
    status: string;
  }>;
  byDepartment: Array<{
    department: string;
    ncCount: number;
    totalCopq: number;
    avgCopq: number;
    pctContribution: number;
  }>;
  byProduct: Array<{
    product: string;
    ncCount: number;
    totalCopq: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    monthLabel: string;
    copq: number;
    qaSaved: number | null;
    beforeQaClearance: number | null;
  }>;
  sourceInfo: {
    sourceWorkbook: string | null;
    sheetName: string | null;
    lastUpdated: string | null;
    refreshTime: string | null;
  };
  insights: Array<{
    id: string;
    severity: 'positive' | 'negative' | 'neutral' | 'warning';
    message: string;
  }>;
}


function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

function metadataNumber(metadata: unknown, key: string): number | null {
  const raw = metadataString(metadata, key);
  if (raw == null || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildInsights(input: {
  totalCopqYtd: number | null;
  copqMtd: number | null;
  categoryBreakdown: CopqIntelligence['categoryBreakdown'];
  byDepartment: CopqIntelligence['byDepartment'];
  topContributors: CopqIntelligence['topContributors'];
  monthlyTrend: CopqIntelligence['monthlyTrend'];
}): CopqIntelligence['insights'] {
  const insights: CopqIntelligence['insights'] = [];

  const topCategory = input.categoryBreakdown[0];
  if (topCategory && topCategory.pctOfTotal > 0) {
    insights.push({
      id: 'top-category',
      severity: topCategory.pctOfTotal >= 30 ? 'warning' : 'neutral',
      message: `${topCategory.category} is the largest COPQ category at ${topCategory.pctOfTotal.toFixed(1)}% of total YTD COPQ.`,
    });
  }

  const topDepartment = input.byDepartment[0];
  if (topDepartment) {
    insights.push({
      id: 'top-department',
      severity: 'neutral',
      message: `${topDepartment.department} leads department COPQ with ₹${topDepartment.totalCopq.toLocaleString('en-IN', { maximumFractionDigits: 0 })} across ${topDepartment.ncCount} NCs.`,
    });
  }

  const topNc = input.topContributors[0];
  if (topNc) {
    insights.push({
      id: 'top-nc',
      severity: 'warning',
      message: `Highest single NC: ${topNc.ncNumber} (${topNc.product}) at ₹${topNc.finalCopq.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`,
    });
  }

  if (input.monthlyTrend.length >= 2) {
    const latest = input.monthlyTrend[input.monthlyTrend.length - 1];
    const previous = input.monthlyTrend[input.monthlyTrend.length - 2];
    if (latest.copq > previous.copq * 1.15) {
      insights.push({
        id: 'monthly-spike',
        severity: 'negative',
        message: `COPQ rose to ₹${latest.copq.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in ${latest.monthLabel}, up from ₹${previous.copq.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in ${previous.monthLabel}.`,
      });
    } else if (latest.copq < previous.copq * 0.85) {
      insights.push({
        id: 'monthly-improvement',
        severity: 'positive',
        message: `COPQ improved to ₹${latest.copq.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in ${latest.monthLabel}, down from ₹${previous.copq.toLocaleString('en-IN', { maximumFractionDigits: 0 })} in ${previous.monthLabel}.`,
      });
    }
  }

  if (input.copqMtd != null && input.totalCopqYtd != null && input.totalCopqYtd > 0) {
    const mtdShare = (input.copqMtd / input.totalCopqYtd) * 100;
    if (mtdShare >= 20) {
      insights.push({
        id: 'mtd-concentration',
        severity: 'warning',
        message: `Current month accounts for ${mtdShare.toFixed(1)}% of YTD COPQ, indicating recent quality pressure.`,
      });
    }
  }

  return insights.slice(0, 5);
}

function emptyAnalytics(): Omit<CopqIntelligence, 'summary' | 'sourceInfo' | 'insights'> {
  return {
    categoryBreakdown: [],
    topContributors: [],
    byDepartment: [],
    byProduct: [],
    monthlyTrend: [],
  };
}

export async function buildCopqIntelligence(): Promise<CopqIntelligence> {
  const copqLatest = await KpiRepository.latestValueByCode('COPQ');
  const metadata = copqLatest
    ? await enrichCopqMetadataFromStaging(copqLatest.value.metadataJson)
    : null;
  const totalCopqYtd = copqLatest
    ? resolveCopqHeadlineValue({
      valueDecimal: copqLatest.value.valueDecimal,
      metadata,
    })
    : null;
  const copqMtd = metadataNumber(metadata, 'copqMtd');
  const copqQtd = metadataNumber(metadata, 'copqQtd');
  const qaSavedAmount = metadataNumber(metadata, 'qaSavedAmount');
  const beforeQaClearance = metadataNumber(metadata, 'copqBeforeQaClearance');

  const ncContext = metadata ? await loadNcAnalyticsContext(metadata) : null;
  const analytics = ncContext
    ? buildCopqDrilldownAnalytics(ncContext.records, ncContext.referenceDate, totalCopqYtd)
    : emptyAnalytics();

  const sourceInfo = {
    sourceWorkbook: ncContext?.sourceWorkbook
      ?? metadataString(metadata, 'sourceWorkbookName'),
    sheetName: ncContext?.sheetName
      ?? metadataString(metadata, 'ncRecordsSheetName'),
    lastUpdated: ncContext?.lastUpdated
      ?? metadataString(metadata, 'sourceLastUpdatedAt'),
    refreshTime: copqLatest?.value.calculatedAt.toISOString() ?? null,
  };

  const insights = buildInsights({
    totalCopqYtd,
    copqMtd,
    categoryBreakdown: analytics.categoryBreakdown,
    byDepartment: analytics.byDepartment,
    topContributors: analytics.topContributors,
    monthlyTrend: analytics.monthlyTrend,
  });

  return {
    summary: {
      totalCopqYtd,
      copqMtd,
      copqQtd,
      qaSavedAmount,
      beforeQaClearance,
    },
    ...analytics,
    sourceInfo,
    insights,
  };
}

export function buildCopqSummaryBullets(copq: CopqIntelligence): string[] {
  const bullets: string[] = [];
  if (copq.summary.totalCopqYtd !== null) {
    bullets.push(`Total COPQ YTD is ₹${copq.summary.totalCopqYtd.toLocaleString('en-IN', { maximumFractionDigits: 0 })}.`);
  }
  if (copq.summary.qaSavedAmount !== null) {
    bullets.push(`QA clearance saved ₹${copq.summary.qaSavedAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} before final COPQ was recorded.`);
  }
  for (const insight of copq.insights.slice(0, 2)) {
    bullets.push(insight.message);
  }
  if (bullets.length === 0) {
    bullets.push('Refresh NC Register ingestion to populate COPQ analytics.');
  }
  return bullets.slice(0, 4);
}
