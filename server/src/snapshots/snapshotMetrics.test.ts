import { describe, expect, it } from 'vitest';
import { extractCoreMetrics } from '../command-center/insights.js';
import type {
  DeadSlowStockPayload,
  InventoryWarehousePayload,
  RevenueCustomerGroupPayload,
  RevenueSalespersonPayload,
  RevenueVsCogsPayload,
} from '../reports/types.js';

describe('extractCoreMetrics', () => {
  it('derives KPI values from stored snapshot payloads', () => {
    const revenueVsCogs: RevenueVsCogsPayload = {
      rows: [],
      total: {
        type: 'TOTAL',
        mtdRevenue: 0,
        mtdCogs: 0,
        qtdRevenue: 0,
        qtdCogs: 0,
        ytdRevenue: 1000,
        ytdCogs: 600,
        grossProfitPct: 40,
      },
    };
    const inventory: InventoryWarehousePayload = {
      rows: [],
      totalValue: 5000,
      warehouseCount: 0,
    };
    const deadStock: DeadSlowStockPayload = {
      topProblemItems: [],
      deadStockValue: 100,
      slowMovingValue: 200,
      activeValue: 0,
      deadCount: 0,
      slowCount: 0,
      activeCount: 0,
      problemPct: 6,
      agingBuckets: [],
    };
    const salesperson: RevenueSalespersonPayload = {
      rows: [],
      totalYtd: 1000,
      salespersonCount: 3,
    };

    const metrics = extractCoreMetrics({ revenueVsCogs, inventory, deadStock, salesperson });

    expect(metrics.revenue).toBe(1000);
    expect(metrics.grossProfit).toBe(400);
    expect(metrics.grossMarginPct).toBe(40);
    expect(metrics.inventoryValue).toBe(5000);
    expect(metrics.deadStockValue).toBe(100);
    expect(metrics.slowMovingValue).toBe(200);
  });

  it('falls back to customer group revenue when COGS total is zero', () => {
    const revenueVsCogs: RevenueVsCogsPayload = {
      rows: [],
      total: {
        type: 'TOTAL',
        mtdRevenue: 0,
        mtdCogs: 0,
        qtdRevenue: 0,
        qtdCogs: 0,
        ytdRevenue: 0,
        ytdCogs: 0,
        grossProfitPct: 0,
      },
    };

    const metrics = extractCoreMetrics({
      revenueVsCogs,
      inventory: null,
      deadStock: null,
      salesperson: null,
      customerGroup: { rows: [], totalYtd: 24843177.69 },
      productGroup: null,
    });

    expect(metrics.revenue).toBe(24843177.69);
  });
});
