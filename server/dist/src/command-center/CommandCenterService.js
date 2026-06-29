import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotMetricsRepository } from '../repositories/SnapshotMetricsRepository.js';
import { buildCopqKpi } from './copqKpi.js';
import { buildCopqSourceDebug } from './copqSourceDebug.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';
import { buildCopqIntelligence, buildCopqSummaryBullets } from './copqIntelligence.js';
import { buildInventoryDaysIntelligence, buildInventoryDaysKpi, buildInventoryDaysSummaryBullets, buildInventoryDaysTrends, buildInventoryKpi, resolveInventorySnapshotDate, } from './inventoryDays.js';
import { normalizeSnapshotDate, resolveSnapshotDateFromBatch } from '../snapshots/snapshotDate.js';
import { PbtService } from '../pbt/PbtService.js';
import { ProductivityService, buildProductivitySummaryBullets } from '../productivity/ProductivityService.js';
import { getFetchActivitySnapshot } from '../ingestion/fetchActivityLog.js';
import { extractCoreMetrics, generateInsights, generateDrilldownSummaries, buildKpi, buildComparisonMetric, extractRevenuePeriods, buildRevenueSubMetrics } from './insights.js';
import { buildSnapshotAvailability } from '../snapshots/snapshotAvailability.js';
function payloadMap(batch) {
    const map = new Map();
    for (const row of batch)
        map.set(row.reportType, row);
    const resolvedDate = resolveSnapshotDateFromBatch(batch, {
        preferredReportType: 'INVENTORY_BY_WAREHOUSE',
        debugLabel: 'command-center-batch',
    }).snapshotDate ?? normalizeSnapshotDate(batch[0]?.snapshotDate) ?? new Date().toISOString().slice(0, 10);
    return {
        salesperson: map.get('REVENUE_BY_SALESPERSON')?.payloadJson,
        customerGroup: map.get('REVENUE_BY_CUSTOMER_GROUP')?.payloadJson,
        productGroup: map.get('REVENUE_BY_PRODUCT_GROUP')?.payloadJson,
        revenueVsCogs: map.get('REVENUE_VS_COGS')?.payloadJson,
        inventory: map.get('INVENTORY_BY_WAREHOUSE')?.payloadJson,
        deadStock: map.get('DEAD_SLOW_MOVING_STOCK')?.payloadJson,
        snapshotTimestamp: batch[0]?.snapshotTimestamp.toISOString() ?? new Date().toISOString(),
        snapshotDate: resolvedDate,
        snapshotKey: batch[0]?.snapshotKey ?? '',
    };
}
function filterSalesperson(payload, filters) {
    if (!payload || !filters.salesperson)
        return payload ?? null;
    const rows = payload.rows.filter((row) => row.name.toLowerCase().includes(filters.salesperson.toLowerCase()));
    const totalYtd = rows.reduce((sum, row) => sum + row.ytd, 0);
    return { ...payload, rows, totalYtd, salespersonCount: rows.length };
}
function buildCustomerGroupInsights(customerGroup, previousCustomerGroup) {
    const sorted = [...(customerGroup?.rows ?? [])].sort((a, b) => b.ytd - a.ytd);
    const previousByName = new Map((previousCustomerGroup?.rows ?? []).map((row) => [row.name, row.ytd]));
    const totalGroups = sorted.length;
    return sorted.map((row, index) => {
        const previousValue = previousByName.get(row.name);
        const growthPct = previousValue && previousValue > 0
            ? ((row.ytd - previousValue) / previousValue) * 100
            : null;
        return {
            name: row.name,
            value: row.ytd,
            contributionPct: row.contributionPct,
            rank: index + 1,
            totalGroups,
            growthPct,
        };
    });
}
function buildRevenueIntelligence(salesperson, customerGroup, previousCustomerGroup, productGroup, revenueHistory, filters) {
    const filteredSales = filterSalesperson(salesperson ?? undefined, filters);
    const bySalesperson = [...(filteredSales?.rows ?? [])]
        .sort((a, b) => b.ytd - a.ytd)
        .map((row) => ({ name: row.name, value: row.ytd, contributionPct: row.contributionPct }));
    const byCustomerGroup = [...(customerGroup?.rows ?? [])]
        .sort((a, b) => b.ytd - a.ytd)
        .map((row) => ({ name: row.name, value: row.ytd, contributionPct: row.contributionPct }));
    const customerGroupInsights = buildCustomerGroupInsights(customerGroup, previousCustomerGroup);
    const byProductGroup = [...(productGroup?.rows ?? [])]
        .sort((a, b) => b.ytdAmount - a.ytdAmount)
        .map((row) => ({ name: row.name, value: row.ytdAmount, contributionPct: row.contributionPct }));
    const topPerformers = bySalesperson.slice(0, 5).map((row, index) => ({ ...row, rank: index + 1 }));
    return { trend: revenueHistory, bySalesperson, byCustomerGroup, customerGroupInsights, byProductGroup, topPerformers };
}
function buildProfitability(revenueVsCogs, marginHistory) {
    const total = revenueVsCogs?.total;
    const revenue = total?.ytdRevenue ?? 0;
    const cogs = total?.ytdCogs ?? 0;
    const grossProfit = revenue - cogs;
    const grossMarginPct = total?.grossProfitPct ?? (revenue ? (grossProfit / revenue) * 100 : 0);
    return {
        revenue,
        cogs,
        grossProfit,
        grossMarginPct,
        marginTrend: marginHistory,
        byCategory: (revenueVsCogs?.rows ?? []).map((row) => ({
            type: row.type,
            revenue: row.ytdRevenue,
            cogs: row.ytdCogs,
            marginPct: row.grossProfitPct,
        })),
    };
}
function buildInventory(inventory, inventoryHistory, filters) {
    let rows = [...(inventory?.rows ?? [])].sort((a, b) => b.stockValue - a.stockValue);
    if (filters.warehouse) {
        rows = rows.filter((row) => row.name.toLowerCase().includes(filters.warehouse.toLowerCase()));
    }
    const top = rows[0];
    return {
        totalValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
        trend: inventoryHistory,
        byWarehouse: rows.map((row) => ({
            name: row.name,
            value: row.stockValue,
            contributionPct: row.contributionPct,
            skuCount: row.skuCount,
        })),
        concentration: {
            topWarehouse: top?.name ?? 'N/A',
            topSharePct: top?.contributionPct ?? 0,
        },
    };
}
function buildDeadStock(deadStock, deadHistory) {
    return {
        deadStockValue: deadStock?.deadStockValue ?? 0,
        slowMovingValue: deadStock?.slowMovingValue ?? 0,
        problemPct: deadStock?.problemPct ?? 0,
        trend: deadHistory,
        topProblemItems: (deadStock?.topProblemItems ?? []).map((row) => ({
            itemNo: row.itemNo,
            description: row.description,
            value: row.stockValue,
            status: row.status,
            daysIdle: row.daysIdle,
        })),
        agingBuckets: deadStock?.agingBuckets ?? [],
    };
}
async function buildHistoriesFromMetrics() {
    const rows = await SnapshotMetricsRepository.listHistory(120);
    const revenueHistory = rows
        .filter((row) => row.revenue != null)
        .map((row) => ({
        snapshotKey: row.snapshotKey,
        snapshotDate: row.snapshotDate,
        value: row.revenue,
    }));
    const grossProfitHistory = rows.map((row) => ({
        snapshotKey: row.snapshotKey,
        snapshotDate: row.snapshotDate,
        value: row.grossProfit ?? 0,
    }));
    const marginHistory = rows.map((row) => ({
        snapshotKey: row.snapshotKey,
        snapshotDate: row.snapshotDate,
        value: row.grossMargin ?? 0,
    }));
    const inventoryHistory = rows.map((row) => ({
        snapshotKey: row.snapshotKey,
        snapshotDate: row.snapshotDate,
        value: row.inventoryValue ?? 0,
    }));
    const deadHistory = rows.map((row) => ({
        snapshotKey: row.snapshotKey,
        snapshotDate: row.snapshotDate,
        dead: row.deadStock ?? 0,
        slow: row.slowMovingStock ?? 0,
    }));
    return { revenueHistory, grossProfitHistory, marginHistory, inventoryHistory, deadHistory };
}
function metricsRowToCore(row) {
    if (!row)
        return null;
    return {
        revenue: row.revenue,
        grossProfit: row.grossProfit,
        grossMarginPct: row.grossMargin,
        ytdCogs: row.ytdCogs,
        inventoryValue: row.inventoryValue,
        deadStockValue: row.deadStock,
        slowMovingValue: row.slowMovingStock,
    };
}
function resolveCoreMetrics(metricsRow, batch) {
    const fromDb = metricsRowToCore(metricsRow);
    if (fromDb)
        return fromDb;
    return extractCoreMetrics({
        revenueVsCogs: batch.revenueVsCogs ?? null,
        inventory: batch.inventory ?? null,
        deadStock: batch.deadStock ?? null,
        salesperson: batch.salesperson ?? null,
        customerGroup: batch.customerGroup ?? null,
        productGroup: batch.productGroup ?? null,
    });
}
async function buildHistories() {
    const metricsCount = await SnapshotMetricsRepository.count();
    if (metricsCount > 0)
        return buildHistoriesFromMetrics();
    return buildHistoriesFallback();
}
async function buildHistoriesFallback() {
    const [revenueRows, cogsRows, inventoryRows, deadRows] = await Promise.all([
        ReportSnapshotRepository.historyForType('REVENUE_VS_COGS', 120),
        ReportSnapshotRepository.historyForType('REVENUE_VS_COGS', 120),
        ReportSnapshotRepository.historyForType('INVENTORY_BY_WAREHOUSE', 120),
        ReportSnapshotRepository.historyForType('DEAD_SLOW_MOVING_STOCK', 120),
    ]);
    const revenueHistory = revenueRows
        .map((row) => {
        const payload = row.payloadJson;
        const value = payload.total?.ytdRevenue ?? 0;
        return { snapshotKey: row.snapshotKey, snapshotDate: row.snapshotDate, value };
    })
        .filter((point) => point.value > 0);
    const grossProfitHistory = revenueRows.map((row) => {
        const payload = row.payloadJson;
        const rev = payload.total?.ytdRevenue ?? 0;
        const cogs = payload.total?.ytdCogs ?? 0;
        return { snapshotKey: row.snapshotKey, snapshotDate: row.snapshotDate, value: rev - cogs };
    });
    const marginHistory = cogsRows.map((row) => {
        const payload = row.payloadJson;
        return { snapshotKey: row.snapshotKey, snapshotDate: row.snapshotDate, value: payload.total?.grossProfitPct ?? 0 };
    });
    const inventoryHistory = inventoryRows.map((row) => {
        const payload = row.payloadJson;
        return { snapshotKey: row.snapshotKey, snapshotDate: row.snapshotDate, value: payload.totalValue };
    });
    const deadHistory = deadRows.map((row) => {
        const payload = row.payloadJson;
        return { snapshotKey: row.snapshotKey, snapshotDate: row.snapshotDate, dead: payload.deadStockValue, slow: payload.slowMovingValue };
    });
    return { revenueHistory, grossProfitHistory, marginHistory, inventoryHistory, deadHistory };
}
export class CommandCenterService {
    async resolveSnapshotKey(snapshotKey) {
        if (snapshotKey && await ReportSnapshotRepository.isCompleteSnapshotKey(snapshotKey)) {
            return snapshotKey;
        }
        const batches = await ReportSnapshotRepository.listBatches(1);
        return batches[0]?.snapshotKey ?? null;
    }
    async getDashboard(snapshotKey, filters = {}) {
        const resolvedKey = await this.resolveSnapshotKey(snapshotKey);
        if (!resolvedKey)
            throw new Error('No snapshots available. Run data refresh to sync from Google Drive.');
        const [currentBatch, availableSnapshots, histories, inventoryDaysTrends] = await Promise.all([
            ReportSnapshotRepository.getBatch(resolvedKey),
            ReportSnapshotRepository.listBatches(200),
            buildHistories(),
            buildInventoryDaysTrends(),
        ]);
        const currentIndex = availableSnapshots.findIndex((batch) => batch.snapshotKey === resolvedKey);
        const previousKey = currentIndex >= 0 ? availableSnapshots[currentIndex + 1]?.snapshotKey ?? null : null;
        const [previousBatch, currentMetricsRow, previousMetricsRow] = await Promise.all([
            previousKey ? ReportSnapshotRepository.getBatch(previousKey) : Promise.resolve([]),
            SnapshotMetricsRepository.findByKey(resolvedKey),
            previousKey ? SnapshotMetricsRepository.findByKey(previousKey) : Promise.resolve(null),
        ]);
        const current = payloadMap(currentBatch);
        const previous = payloadMap(previousBatch);
        const currentMetrics = resolveCoreMetrics(currentMetricsRow, current);
        const previousMetrics = resolveCoreMetrics(previousMetricsRow, previous);
        const revenuePeriods = extractRevenuePeriods({
            revenueVsCogs: current.revenueVsCogs ?? null,
            salesperson: current.salesperson ?? null,
            customerGroup: current.customerGroup ?? null,
            productGroup: current.productGroup ?? null,
        });
        const metricInputs = {
            inventoryValue: currentMetrics.inventoryValue,
            previousInventoryValue: previousMetrics.inventoryValue,
            ytdCogs: currentMetrics.ytdCogs,
            previousYtdCogs: previousMetrics.ytdCogs,
            snapshotDate: resolveInventorySnapshotDate(currentBatch, current.snapshotDate) ?? current.snapshotDate,
            previousSnapshotDate: previousBatch.length > 0
                ? resolveInventorySnapshotDate(previousBatch, previousMetricsRow?.snapshotDate ?? previous.snapshotDate)
                : null,
        };
        const kpis = [
            buildKpi('revenue', 'Revenue', currentMetrics.revenue, previousMetrics.revenue, 'currency', histories.revenueHistory, undefined, buildRevenueSubMetrics(revenuePeriods)),
            buildKpi('grossProfit', 'Gross Profit', currentMetrics.grossProfit, previousMetrics.grossProfit, 'currency', histories.grossProfitHistory),
            buildKpi('grossMargin', 'Gross Margin', currentMetrics.grossMarginPct, previousMetrics.grossMarginPct, 'percent', histories.marginHistory, currentMetrics.grossMarginPct && currentMetrics.grossMarginPct >= 40 ? 'good' : 'warning', undefined, { healthFromTrend: false }),
            buildInventoryKpi({
                inventoryValue: metricInputs.inventoryValue,
                previousInventoryValue: metricInputs.previousInventoryValue,
                inventoryValueHistory: histories.inventoryHistory,
            }),
            buildInventoryDaysKpi({
                ...metricInputs,
                inventoryDaysHistory: inventoryDaysTrends,
            }),
            buildKpi('deadStock', 'Dead Stock', currentMetrics.deadStockValue, previousMetrics.deadStockValue, 'currency', histories.deadHistory.map((p) => ({ snapshotKey: p.snapshotKey, snapshotDate: p.snapshotDate, value: p.dead }))),
            buildKpi('slowMoving', 'Slow Moving Stock', currentMetrics.slowMovingValue, previousMetrics.slowMovingValue, 'currency', histories.deadHistory.map((p) => ({ snapshotKey: p.snapshotKey, snapshotDate: p.snapshotDate, value: p.slow }))),
        ];
        const copqKpi = await buildCopqKpi();
        if (copqKpi)
            kpis.push(copqKpi);
        let copqSourceDebug;
        try {
            copqSourceDebug = await buildCopqSourceDebug(copqKpi);
        }
        catch (error) {
            console.error('[copq:debug] Failed to build copqSourceDebug payload', error);
            copqSourceDebug = undefined;
        }
        const pbtService = new PbtService();
        const pbtKpi = await pbtService.buildKpi();
        if (pbtKpi)
            kpis.splice(3, 0, pbtKpi);
        const productivityService = new ProductivityService();
        const productivityKpi = await productivityService.buildKpi({
            snapshotDate: current.snapshotDate,
            revenuePayload: current.revenueVsCogs ?? null,
            previousSnapshotDate: previousBatch.length > 0 ? previous.snapshotDate : null,
            previousRevenuePayload: previous.revenueVsCogs ?? null,
        });
        kpis.push(productivityKpi);
        const pbtIntel = await pbtService.buildIntelligence();
        const productivityIntel = await productivityService.buildIntelligence({
            snapshotDate: current.snapshotDate,
            revenuePayload: current.revenueVsCogs ?? null,
            previousSnapshotDate: previousBatch.length > 0 ? previous.snapshotDate : null,
            previousRevenuePayload: previous.revenueVsCogs ?? null,
        });
        const topSalesperson = current.salesperson?.rows.sort((a, b) => b.ytd - a.ytd)[0];
        const topWarehouse = current.inventory?.rows.sort((a, b) => b.stockValue - a.stockValue)[0];
        const revenueIntel = buildRevenueIntelligence(current.salesperson ?? null, current.customerGroup ?? null, previous.customerGroup ?? null, current.productGroup ?? null, histories.revenueHistory, filters);
        const profitabilityIntel = buildProfitability(current.revenueVsCogs ?? null, histories.marginHistory);
        const inventoryIntel = buildInventory(current.inventory ?? null, histories.inventoryHistory, filters);
        const inventoryDaysIntel = await buildInventoryDaysIntelligence({
            snapshotKey: resolvedKey,
            snapshotDate: current.snapshotDate,
            inventoryValue: currentMetrics.inventoryValue,
            ytdCogs: currentMetrics.ytdCogs,
            currentBatch,
        });
        const deadStockIntel = buildDeadStock(current.deadStock ?? null, histories.deadHistory);
        const copqIntel = await buildCopqIntelligence();
        const latestSnapshotDate = await ReportSnapshotRepository.getLatestSnapshotDate();
        const snapshotAvailability = buildSnapshotAvailability(latestSnapshotDate ?? current.snapshotDate);
        const response = {
            snapshotKey: resolvedKey,
            snapshotDate: current.snapshotDate,
            snapshotTimestamp: current.snapshotTimestamp,
            snapshotAvailability,
            previousSnapshotKey: previousKey,
            availableSnapshots,
            kpis,
            revenuePeriods,
            insights: generateInsights({
                revenue: currentMetrics.revenue,
                previousRevenue: previousMetrics.revenue,
                grossMarginPct: currentMetrics.grossMarginPct,
                previousGrossMarginPct: previousMetrics.grossMarginPct,
                inventoryValue: currentMetrics.inventoryValue,
                previousInventoryValue: previousMetrics.inventoryValue,
                deadStockValue: currentMetrics.deadStockValue,
                previousDeadStockValue: previousMetrics.deadStockValue,
                slowMovingValue: currentMetrics.slowMovingValue,
                previousSlowMovingValue: previousMetrics.slowMovingValue,
                topSalesperson: topSalesperson ? { name: topSalesperson.name, contributionPct: topSalesperson.contributionPct } : undefined,
                topWarehouse: topWarehouse ? { name: topWarehouse.name, contributionPct: topWarehouse.contributionPct } : undefined,
            }),
            revenue: revenueIntel,
            profitability: profitabilityIntel,
            inventory: inventoryIntel,
            inventoryDays: inventoryDaysIntel,
            deadStock: deadStockIntel,
            pbt: pbtIntel,
            productivity: productivityIntel,
            copq: copqIntel,
            copqSourceDebug,
            summaries: {
                ...generateDrilldownSummaries({
                    currentMetrics,
                    previousMetrics,
                    revenue: revenueIntel,
                    profitability: profitabilityIntel,
                    inventory: inventoryIntel,
                    deadStock: deadStockIntel,
                    pbt: pbtIntel,
                }),
                copq: {
                    title: 'COPQ Executive Summary',
                    bullets: buildCopqSummaryBullets(copqIntel),
                },
                inventoryDays: {
                    title: 'Inventory Days Executive Summary',
                    bullets: buildInventoryDaysSummaryBullets(inventoryDaysIntel),
                },
                productivity: {
                    title: 'Productivity Index Executive Summary',
                    bullets: buildProductivitySummaryBullets(productivityIntel),
                },
            },
            filters: {
                salespersons: [...new Set((current.salesperson?.rows ?? []).map((row) => row.name))],
                customerGroups: [...new Set((current.customerGroup?.rows ?? []).map((row) => row.name))],
                productGroups: [...new Set((current.productGroup?.rows ?? []).map((row) => row.name))],
                warehouses: [...new Set((current.inventory?.rows ?? []).map((row) => row.name))],
            },
            syncedAt: new Date().toISOString(),
            fetchActivity: getFetchActivitySnapshot(),
        };
        const apiCopqKpi = response.kpis.find((kpi) => kpi.key === 'copq') ?? null;
        logO34Stage('API O34', {
            value: apiCopqKpi?.value ?? null,
            sourceCell: apiCopqKpi?.metadata?.sourceCell ?? null,
            copqYtd: apiCopqKpi?.metadata?.copqYtd ?? null,
            ytdSubMetric: apiCopqKpi?.subMetrics?.find((metric) => metric.key === 'ytd')?.value ?? null,
        }, (apiCopqKpi?.metadata ?? {}));
        return response;
    }
    async compare(currentSnapshotKey, previousSnapshotKey) {
        const [currentMetricsRow, previousMetricsRow, currentBatch, previousBatch] = await Promise.all([
            SnapshotMetricsRepository.findByKey(currentSnapshotKey),
            SnapshotMetricsRepository.findByKey(previousSnapshotKey),
            ReportSnapshotRepository.getBatch(currentSnapshotKey),
            ReportSnapshotRepository.getBatch(previousSnapshotKey),
        ]);
        const current = resolveCoreMetrics(currentMetricsRow, payloadMap(currentBatch));
        const previous = resolveCoreMetrics(previousMetricsRow, payloadMap(previousBatch));
        return {
            currentSnapshotKey,
            previousSnapshotKey,
            metrics: [
                buildComparisonMetric('revenue', 'Revenue', current.revenue, previous.revenue),
                buildComparisonMetric('grossProfit', 'Gross Profit', current.grossProfit, previous.grossProfit),
                buildComparisonMetric('grossMargin', 'Gross Margin %', current.grossMarginPct, previous.grossMarginPct),
                buildComparisonMetric('inventoryValue', 'Inventory Value', current.inventoryValue, previous.inventoryValue),
                buildComparisonMetric('deadStock', 'Dead Stock', current.deadStockValue, previous.deadStockValue),
                buildComparisonMetric('slowMoving', 'Slow Moving Stock', current.slowMovingValue, previous.slowMovingValue),
            ],
        };
    }
}
