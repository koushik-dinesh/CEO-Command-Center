import { extractCoreMetrics } from '../command-center/insights.js';
import { computeInventoryDaysMetrics } from '../command-center/inventoryDays.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
import type { ReportSnapshotRow } from '../repositories/ReportSnapshotRepository.js';
import { SnapshotMetricsRepository } from '../repositories/SnapshotMetricsRepository.js';
import { refreshRevenueDrilldownCacheFromSnapshot } from '../revenue/revenue-drilldown-builder.js';
import { isCompleteReportCount, REQUIRED_SNAPSHOT_REPORT_COUNT } from './snapshotCompleteness.js';
import type {
  DeadSlowStockPayload,
  InventoryWarehousePayload,
  RevenueCustomerGroupPayload,
  RevenueProductGroupPayload,
  RevenueSalespersonPayload,
  RevenueVsCogsPayload,
} from '../reports/types.js';

function payloadMap(batch: ReportSnapshotRow[]) {
  const map = new Map(batch.map((row) => [row.reportType, row.payloadJson]));
  return {
    revenueVsCogs: (map.get('REVENUE_VS_COGS') as RevenueVsCogsPayload | undefined) ?? null,
    inventory: (map.get('INVENTORY_BY_WAREHOUSE') as InventoryWarehousePayload | undefined) ?? null,
    deadStock: (map.get('DEAD_SLOW_MOVING_STOCK') as DeadSlowStockPayload | undefined) ?? null,
    salesperson: (map.get('REVENUE_BY_SALESPERSON') as RevenueSalespersonPayload | undefined) ?? null,
    customerGroup: (map.get('REVENUE_BY_CUSTOMER_GROUP') as RevenueCustomerGroupPayload | undefined) ?? null,
    productGroup: (map.get('REVENUE_BY_PRODUCT_GROUP') as RevenueProductGroupPayload | undefined) ?? null,
  };
}

export class SnapshotMetricsService {
  static async recomputeForSnapshotKey(snapshotKey: string): Promise<void> {
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
      snapshotDate: batch[0]!.snapshotDate,
    });

    await SnapshotMetricsRepository.upsert({
      snapshotKey,
      snapshotDate: batch[0]!.snapshotDate,
      snapshotTimestamp: batch[0]!.snapshotTimestamp,
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

    const salespersonRow = batch.find((row) => row.reportType === 'REVENUE_BY_SALESPERSON');
    if (salespersonRow) {
      try {
        await refreshRevenueDrilldownCacheFromSnapshot(salespersonRow);
      } catch (error) {
        console.warn(`[snapshot-metrics] Revenue drilldown cache update failed for ${snapshotKey}`, error);
      }
    }
  }

  static async recomputeForSnapshotKeys(snapshotKeys: Iterable<string>): Promise<void> {
    for (const snapshotKey of snapshotKeys) {
      await this.recomputeForSnapshotKey(snapshotKey);
    }
  }

  static async backfillAll(): Promise<number> {
    const keys = await SnapshotMetricsRepository.listDistinctSnapshotKeys();
    for (const snapshotKey of keys) {
      await this.recomputeForSnapshotKey(snapshotKey);
    }
    await SnapshotMetricsRepository.deleteIncomplete();
    return SnapshotMetricsRepository.count();
  }
}
