import { extractCoreMetrics } from '../command-center/insights.js';
import { computeInventoryDaysMetrics } from '../command-center/inventoryDays.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotMetricsRepository } from '../repositories/SnapshotMetricsRepository.js';
import { isCompleteReportCount, REQUIRED_SNAPSHOT_REPORT_COUNT } from './snapshotCompleteness.js';
function payloadMap(batch) {
    const map = new Map(batch.map((row) => [row.reportType, row.payloadJson]));
    return {
        revenueVsCogs: map.get('REVENUE_VS_COGS') ?? null,
        inventory: map.get('INVENTORY_BY_WAREHOUSE') ?? null,
        deadStock: map.get('DEAD_SLOW_MOVING_STOCK') ?? null,
        salesperson: map.get('REVENUE_BY_SALESPERSON') ?? null,
        customerGroup: map.get('REVENUE_BY_CUSTOMER_GROUP') ?? null,
        productGroup: map.get('REVENUE_BY_PRODUCT_GROUP') ?? null,
    };
}
export class SnapshotMetricsService {
    static async recomputeForSnapshotKey(snapshotKey) {
        const batch = await ReportSnapshotRepository.getBatch(snapshotKey);
        if (batch.length === 0) {
            await SnapshotMetricsRepository.deleteByKey(snapshotKey);
            return;
        }
        if (!isCompleteReportCount(batch.length)) {
            await SnapshotMetricsRepository.deleteByKey(snapshotKey);
            return;
        }
        const payloads = payloadMap(batch);
        const metrics = extractCoreMetrics(payloads);
        if (metrics.revenue == null) {
            await SnapshotMetricsRepository.deleteByKey(snapshotKey);
            return;
        }
        const computedAt = new Date();
        const ytdCogs = payloads.revenueVsCogs?.total?.ytdCogs ?? null;
        const inventoryDaysResult = computeInventoryDaysMetrics({
            inventoryValue: metrics.inventoryValue,
            ytdCogs,
            snapshotDate: batch[0].snapshotDate,
        });
        await SnapshotMetricsRepository.upsert({
            snapshotKey,
            snapshotDate: batch[0].snapshotDate,
            snapshotTimestamp: batch[0].snapshotTimestamp,
            revenue: metrics.revenue,
            grossProfit: metrics.grossProfit,
            grossMargin: metrics.grossMarginPct,
            ytdCogs,
            daysElapsed: inventoryDaysResult.daysElapsed,
            inventoryDays: inventoryDaysResult.inventoryDays,
            itr: null,
            inventoryValue: metrics.inventoryValue,
            deadStock: metrics.deadStockValue,
            slowMovingStock: metrics.slowMovingValue,
            reportCount: batch.length,
            completeness: batch.length / REQUIRED_SNAPSHOT_REPORT_COUNT,
            fileNames: batch.map((row) => row.fileName),
            computedAt,
        });
    }
    static async recomputeForSnapshotKeys(snapshotKeys) {
        for (const snapshotKey of snapshotKeys) {
            await this.recomputeForSnapshotKey(snapshotKey);
        }
    }
    static async backfillAll() {
        const keys = await SnapshotMetricsRepository.listDistinctSnapshotKeys();
        for (const snapshotKey of keys) {
            await this.recomputeForSnapshotKey(snapshotKey);
        }
        await SnapshotMetricsRepository.deleteIncomplete();
        return SnapshotMetricsRepository.count();
    }
}
