import { Decimal } from 'decimal.js';
import { normalizeSnapshotDate, resolveSnapshotDateFromBatch } from '../snapshots/snapshotDate.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotMetricsRepository } from '../repositories/SnapshotMetricsRepository.js';
import { isCompleteReportCount } from '../snapshots/snapshotCompleteness.js';
import { getInventoryDaysTargets } from './kpiConfig.js';
import { evaluateTargetRangeHealth, targetRangeStatusTooltip, } from './kpiSemantics.js';
import { buildKpi, changeMetrics } from './insights.js';
const INVENTORY_DAYS_METHODOLOGY = 'Inventory Days = Current Inventory × Days Elapsed ÷ YTD COGS. ' +
    'Current inventory is the total stock value across all warehouses from the latest inventory snapshot. ' +
    'YTD COGS is taken from the TOTAL row of the Revenue vs COGS fiscal dataset. ' +
    'Days Elapsed = (Snapshot Date − April 1 of the financial year) + 1.';
export function parseSnapshotDate(snapshotDate) {
    const normalized = normalizeSnapshotDate(snapshotDate);
    if (!normalized)
        return null;
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
/** April 1 of the financial year that contains the snapshot date. */
export function financialYearStartDate(snapshotDate) {
    const snapshot = parseSnapshotDate(snapshotDate);
    if (!snapshot)
        return null;
    const year = snapshot.getMonth() >= 3 ? snapshot.getFullYear() : snapshot.getFullYear() - 1;
    return `${year}-04-01`;
}
/** Days elapsed in the financial year through the snapshot date, inclusive. */
export function daysElapsedInFinancialYear(snapshotDate) {
    const normalized = normalizeSnapshotDate(snapshotDate);
    const snapshot = parseSnapshotDate(snapshotDate);
    const fyStartStr = financialYearStartDate(snapshotDate);
    if (!snapshot || !fyStartStr)
        return null;
    const fyStart = parseSnapshotDate(fyStartStr);
    if (!fyStart)
        return null;
    const diffMs = snapshot.getTime() - fyStart.getTime();
    if (diffMs < 0)
        return null;
    return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}
export function calculateInventoryDays(inventoryValue, ytdCogs, daysElapsed) {
    if (!Number.isFinite(inventoryValue) || inventoryValue < 0)
        return null;
    if (!Number.isFinite(ytdCogs) || ytdCogs <= 0)
        return null;
    if (!Number.isFinite(daysElapsed) || daysElapsed <= 0)
        return null;
    return new Decimal(inventoryValue).mul(daysElapsed).div(ytdCogs).toDecimalPlaces(1).toNumber();
}
export function computeInventoryDaysMetrics(input) {
    const normalizedSnapshotDate = normalizeSnapshotDate(input.snapshotDate);
    const financialYearStart = financialYearStartDate(input.snapshotDate);
    const daysElapsed = daysElapsedInFinancialYear(input.snapshotDate);
    if (process.env.NODE_ENV !== 'production') {
        console.log('[inventory-days] calculation inputs', {
            rawSnapshotDate: input.snapshotDate,
            parsedSnapshotDate: normalizedSnapshotDate,
            fyStartDate: financialYearStart,
            daysElapsed,
            inventoryValue: input.inventoryValue,
            ytdCogs: input.ytdCogs,
        });
    }
    if (!financialYearStart || daysElapsed === null) {
        return {
            currentInventoryValue: input.inventoryValue,
            ytdCogs: input.ytdCogs,
            daysElapsed: null,
            inventoryDays: null,
            financialYearStart,
            statusMessage: 'Invalid or missing snapshot date for financial year calculation.',
        };
    }
    if (input.inventoryValue === null || !Number.isFinite(input.inventoryValue)) {
        return {
            currentInventoryValue: null,
            ytdCogs: input.ytdCogs,
            daysElapsed,
            inventoryDays: null,
            financialYearStart,
            statusMessage: 'Current inventory value is not available from the latest warehouse snapshot.',
        };
    }
    if (input.ytdCogs === null || !Number.isFinite(input.ytdCogs)) {
        return {
            currentInventoryValue: input.inventoryValue,
            ytdCogs: null,
            daysElapsed,
            inventoryDays: null,
            financialYearStart,
            statusMessage: 'YTD COGS is not available from the Revenue vs COGS dataset.',
        };
    }
    if (input.ytdCogs === 0) {
        return {
            currentInventoryValue: input.inventoryValue,
            ytdCogs: 0,
            daysElapsed,
            inventoryDays: null,
            financialYearStart,
            statusMessage: 'YTD COGS is zero — inventory days cannot be calculated.',
        };
    }
    const inventoryDays = calculateInventoryDays(input.inventoryValue, input.ytdCogs, daysElapsed);
    if (process.env.NODE_ENV !== 'production') {
        console.log('[inventory-days] calculation result', {
            inventoryDays,
        });
    }
    return {
        currentInventoryValue: input.inventoryValue,
        ytdCogs: input.ytdCogs,
        daysElapsed,
        inventoryDays,
        financialYearStart,
        statusMessage: inventoryDays === null ? 'Inventory days could not be calculated from available inputs.' : null,
    };
}
export function resolveInventorySnapshotDate(batch, fallback) {
    const resolved = resolveSnapshotDateFromBatch(batch, {
        preferredReportType: 'INVENTORY_BY_WAREHOUSE',
        fallback,
        debugLabel: 'inventory-days-kpi',
    });
    return resolved.snapshotDate;
}
export function buildInventoryKpi(input) {
    return {
        ...buildKpi('inventoryValue', 'Inventory', input.inventoryValue, input.previousInventoryValue, 'currency', input.inventoryValueHistory, 'neutral'),
        drilldownPath: '/intelligence/inventory',
    };
}
function resolveMetricPair(input) {
    const current = computeInventoryDaysMetrics({
        inventoryValue: input.inventoryValue,
        ytdCogs: input.ytdCogs,
        snapshotDate: input.snapshotDate,
    });
    const previous = input.previousSnapshotDate
        ? computeInventoryDaysMetrics({
            inventoryValue: input.previousInventoryValue,
            ytdCogs: input.previousYtdCogs,
            snapshotDate: input.previousSnapshotDate,
        })
        : null;
    return { current, previous };
}
export function buildInventoryDaysKpi(input) {
    const { current, previous } = resolveMetricPair(input);
    return {
        ...buildKpi('inventoryDays', 'Inventory Days', current.inventoryDays, previous?.inventoryDays ?? null, 'days', input.inventoryDaysHistory),
        drilldownPath: '/intelligence/inventory-days',
        footnote: current.statusMessage,
    };
}
function payloadFromBatch(batch) {
    const map = new Map(batch.map((row) => [row.reportType, row]));
    const resolved = resolveSnapshotDateFromBatch(batch, { preferredReportType: 'INVENTORY_BY_WAREHOUSE' });
    const inventoryRow = map.get('INVENTORY_BY_WAREHOUSE');
    const cogsRow = map.get('REVENUE_VS_COGS');
    return {
        inventory: inventoryRow?.payloadJson ?? null,
        revenueVsCogs: cogsRow?.payloadJson ?? null,
        snapshotDate: resolved.snapshotDate ?? normalizeSnapshotDate(batch[0]?.snapshotDate) ?? '',
        snapshotKey: batch[0]?.snapshotKey ?? '',
    };
}
/** One trend point per stored snapshot — no gap-filling or interpolation. */
export function buildTrendPointsFromMetricsRows(rows) {
    const inventoryDays = [];
    for (const row of rows) {
        const snapshotDate = normalizeSnapshotDate(row.snapshotDate) ?? String(row.snapshotDate ?? '');
        const ytdCogs = row.ytdCogs;
        if (row.inventoryValue == null || ytdCogs == null)
            continue;
        const inventoryDaysValue = row.inventoryDays ?? computeInventoryDaysMetrics({
            inventoryValue: row.inventoryValue,
            ytdCogs,
            snapshotDate,
        }).inventoryDays;
        if (inventoryDaysValue !== null) {
            inventoryDays.push({
                snapshotKey: row.snapshotKey,
                snapshotDate,
                value: inventoryDaysValue,
            });
        }
    }
    return inventoryDays;
}
async function buildTrendsFromMetrics() {
    const rows = await SnapshotMetricsRepository.listHistory(120);
    return buildTrendPointsFromMetricsRows(rows);
}
async function buildTrendsFallback() {
    const batches = await ReportSnapshotRepository.listBatches(120);
    const inventoryDays = [];
    const chronological = [...batches].reverse();
    for (const meta of chronological) {
        const batch = await ReportSnapshotRepository.getBatch(meta.snapshotKey);
        if (!isCompleteReportCount(batch.length))
            continue;
        const payloads = payloadFromBatch(batch);
        const computed = computeInventoryDaysMetrics({
            inventoryValue: payloads.inventory?.totalValue ?? null,
            ytdCogs: payloads.revenueVsCogs?.total?.ytdCogs ?? null,
            snapshotDate: payloads.snapshotDate,
        });
        if (computed.inventoryDays !== null) {
            inventoryDays.push({
                snapshotKey: payloads.snapshotKey,
                snapshotDate: payloads.snapshotDate,
                value: computed.inventoryDays,
            });
        }
    }
    return inventoryDays;
}
export async function buildInventoryDaysTrends() {
    const metricsCount = await SnapshotMetricsRepository.count();
    if (metricsCount > 0)
        return buildTrendsFromMetrics();
    return buildTrendsFallback();
}
export function buildInventoryDaysSummaryBullets(intel) {
    const bullets = [];
    const { summary } = intel;
    if (summary.inventoryDays !== null) {
        bullets.push(`Inventory days stand at ${summary.inventoryDays.toFixed(1)} (target ${summary.targetMinDays}–${summary.targetMaxDays} days).`);
    }
    else if (summary.statusMessage) {
        bullets.push(summary.statusMessage);
    }
    const trend = intel.trend;
    if (trend.length >= 2) {
        const previous = trend[trend.length - 2].value;
        const latest = trend[trend.length - 1].value;
        const { changePercent } = changeMetrics(latest, previous);
        if (changePercent !== null && changePercent !== 0) {
            const direction = changePercent < 0 ? 'decreased' : 'increased';
            bullets.push(`Inventory days ${direction} by ${Math.abs(changePercent).toFixed(1)}% versus the prior snapshot.`);
        }
    }
    if (summary.statusTooltip) {
        bullets.push(summary.statusTooltip);
    }
    if (summary.currentInventoryValue !== null && summary.ytdCogs !== null) {
        bullets.push(`Based on current inventory of ${summary.currentInventoryValue.toLocaleString('en-IN')} and YTD COGS of ${summary.ytdCogs.toLocaleString('en-IN')}.`);
    }
    return bullets.slice(0, 4);
}
export async function buildInventoryDaysIntelligence(input) {
    const inventoryRow = input.currentBatch.find((row) => row.reportType === 'INVENTORY_BY_WAREHOUSE');
    const resolved = resolveSnapshotDateFromBatch(input.currentBatch, {
        preferredReportType: 'INVENTORY_BY_WAREHOUSE',
        fallback: input.snapshotDate,
        debugLabel: 'inventory-days-intel',
    });
    const snapshotDate = resolved.snapshotDate ?? normalizeSnapshotDate(input.snapshotDate);
    if (process.env.NODE_ENV !== 'production') {
        console.log('[inventory-days] intelligence snapshot date', {
            inventoryFileName: inventoryRow?.fileName ?? null,
            inventorySnapshotDateRaw: inventoryRow?.snapshotDate ?? null,
            inventorySnapshotKey: inventoryRow?.snapshotKey ?? null,
            resolvedSource: resolved.source,
            resolvedSnapshotDate: snapshotDate,
        });
    }
    const summary = computeInventoryDaysMetrics({
        inventoryValue: input.inventoryValue,
        ytdCogs: input.ytdCogs,
        snapshotDate: snapshotDate ?? '',
    });
    const trend = await buildInventoryDaysTrends();
    if (process.env.NODE_ENV !== 'production') {
        console.log('[inventory-days] API trend length:', trend.length);
        console.log('[inventory-days] API trend payload:', trend.map((point) => ({
            snapshotDate: point.snapshotDate,
            snapshotKey: point.snapshotKey,
            value: point.value,
        })));
        console.log('[inventory-days] API trend first 5:', trend.slice(0, 5));
        console.log('[inventory-days] API trend last 5:', trend.slice(-5));
    }
    const inventoryFile = input.currentBatch.find((row) => row.reportType === 'INVENTORY_BY_WAREHOUSE');
    const cogsFile = input.currentBatch.find((row) => row.reportType === 'REVENUE_VS_COGS');
    const targets = getInventoryDaysTargets();
    const health = evaluateTargetRangeHealth(summary.inventoryDays, targets.targetMinDays, targets.targetMaxDays);
    const statusTooltip = targetRangeStatusTooltip(health);
    const insights = [];
    let insightId = 0;
    if (summary.statusMessage) {
        insights.push({
            id: `inv_days_${++insightId}`,
            severity: 'warning',
            message: summary.statusMessage,
        });
    }
    else if (health === 'critical' && summary.inventoryDays !== null) {
        insights.push({
            id: `inv_days_${++insightId}`,
            severity: 'warning',
            message: `Inventory days are above the ${targets.targetMaxDays}-day target at ${summary.inventoryDays.toFixed(1)} days — review stock levels and COGS pace.`,
        });
    }
    else if (health === 'warning' && summary.inventoryDays !== null) {
        insights.push({
            id: `inv_days_${++insightId}`,
            severity: 'warning',
            message: `Inventory days are below the ${targets.targetMinDays}-day target at ${summary.inventoryDays.toFixed(1)} days — possible stock shortage risk.`,
        });
    }
    return {
        summary: {
            currentInventoryValue: summary.currentInventoryValue,
            ytdCogs: summary.ytdCogs,
            daysElapsed: summary.daysElapsed,
            inventoryDays: summary.inventoryDays,
            snapshotDate: snapshotDate ?? input.snapshotDate,
            financialYearStart: summary.financialYearStart ?? '',
            statusMessage: summary.statusMessage,
            targetMinDays: targets.targetMinDays,
            targetMaxDays: targets.targetMaxDays,
            health,
            statusTooltip,
        },
        formula: {
            expression: 'Inventory Days = Inventory × Days Elapsed ÷ YTD COGS',
            inventory: summary.currentInventoryValue,
            daysElapsed: summary.daysElapsed,
            ytdCogs: summary.ytdCogs,
            inventoryDays: summary.inventoryDays,
        },
        trend,
        insights,
        dataSources: [
            {
                key: 'INVENTORY_BY_WAREHOUSE',
                name: 'Dashboard_InventoryDashBoard-Total_Stock_Based_on_Warehouses',
                purpose: 'Current inventory value summed across all warehouses',
                refreshDate: inventoryFile?.snapshotTimestamp.toISOString() ?? input.snapshotDate,
                fileName: inventoryFile?.fileName ?? null,
            },
            {
                key: 'REVENUE_VS_COGS',
                name: 'View_Revenue_vs_COGS_Fiscal',
                purpose: 'YTD COGS from the TOTAL row',
                refreshDate: cogsFile?.snapshotTimestamp.toISOString() ?? input.snapshotDate,
                fileName: cogsFile?.fileName ?? null,
            },
        ],
        methodology: INVENTORY_DAYS_METHODOLOGY,
    };
}
