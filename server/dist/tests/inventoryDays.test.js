import { describe, expect, it } from 'vitest';
import { calculateInventoryDays, computeInventoryDaysMetrics, daysElapsedInFinancialYear, financialYearStartDate, } from '../src/command-center/inventoryDays.js';
describe('inventoryDays', () => {
    it('resolves financial year start on or after April 1', () => {
        expect(financialYearStartDate('2026-06-18')).toBe('2026-04-01');
        expect(financialYearStartDate('2026-03-15')).toBe('2025-04-01');
    });
    it('calculates days elapsed inclusive from April 1', () => {
        expect(daysElapsedInFinancialYear('2026-04-01')).toBe(1);
        expect(daysElapsedInFinancialYear('2026-06-23')).toBe(84);
    });
    it('matches the reference inventory days example', () => {
        const inventoryDays = calculateInventoryDays(366.49, 161.87, 84);
        expect(inventoryDays).toBe(190.2);
    });
    it('returns null inventory days when YTD COGS is zero', () => {
        const result = computeInventoryDaysMetrics({
            inventoryValue: 100,
            ytdCogs: 0,
            snapshotDate: '2026-06-18',
        });
        expect(result.inventoryDays).toBeNull();
        expect(result.statusMessage).toMatch(/zero/i);
    });
    it('handles missing inventory value', () => {
        const result = computeInventoryDaysMetrics({
            inventoryValue: null,
            ytdCogs: 161.87,
            snapshotDate: '2026-06-18',
        });
        expect(result.inventoryDays).toBeNull();
        expect(result.statusMessage).toMatch(/inventory/i);
    });
    it('handles invalid snapshot dates', () => {
        const result = computeInventoryDaysMetrics({
            inventoryValue: 100,
            ytdCogs: 50,
            snapshotDate: 'not-a-date',
        });
        expect(result.daysElapsed).toBeNull();
        expect(result.inventoryDays).toBeNull();
        expect(result.statusMessage).toMatch(/snapshot date/i);
    });
});
