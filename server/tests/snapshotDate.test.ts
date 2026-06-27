import { describe, expect, it } from 'vitest';
import {
  normalizeSnapshotDate,
  parseDateFromFilename,
  parseDateFromSnapshotKey,
  resolveSnapshotDateFromBatch,
} from '../src/snapshots/snapshotDate.js';
import { daysElapsedInFinancialYear, computeInventoryDaysMetrics } from '../src/command-center/inventoryDays.js';

describe('snapshotDate', () => {
  it('normalizes MySQL Date objects to YYYY-MM-DD', () => {
    const mysqlDate = new Date('2026-06-23T00:00:00.000Z');
    expect(normalizeSnapshotDate(mysqlDate)).toBe('2026-06-23');
  });

  it('parses inventory filename timestamps', () => {
    const fileName = 'Dashboard_InventoryDashBoard-Total_Stock_Based_on_Warehouses_20260623_071701.csv';
    expect(parseDateFromFilename(fileName)).toBe('2026-06-23');
  });

  it('parses snapshot keys', () => {
    expect(parseDateFromSnapshotKey('20260623_071701')).toBe('2026-06-23');
  });

  it('resolves snapshot date from inventory batch row metadata', () => {
    const resolved = resolveSnapshotDateFromBatch([
      {
        reportType: 'INVENTORY_BY_WAREHOUSE',
        snapshotDate: new Date('2026-06-23T00:00:00.000Z'),
        snapshotKey: '20260623_071701',
        fileName: 'Dashboard_InventoryDashBoard-Total_Stock_Based_on_Warehouses_20260623_071701.csv',
      },
    ]);
    expect(resolved.snapshotDate).toBe('2026-06-23');
    expect(resolved.source).toContain('INVENTORY_BY_WAREHOUSE');
  });
});

describe('inventoryDays financial year', () => {
  it('calculates 84 days elapsed for 2026-06-23', () => {
    expect(daysElapsedInFinancialYear('2026-06-23')).toBe(84);
    expect(daysElapsedInFinancialYear(new Date('2026-06-23T00:00:00.000Z'))).toBe(84);
  });

  it('computes inventory days when snapshot date is a Date object', () => {
    const result = computeInventoryDaysMetrics({
      inventoryValue: 366.49,
      ytdCogs: 161.87,
      snapshotDate: new Date('2026-06-23T00:00:00.000Z'),
    });
    expect(result.daysElapsed).toBe(84);
    expect(result.inventoryDays).toBe(190.2);
    expect(result.statusMessage).toBeNull();
  });
});
