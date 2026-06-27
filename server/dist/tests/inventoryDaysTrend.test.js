import { describe, expect, it } from 'vitest';
import { buildTrendPointsFromMetricsRows } from '../src/command-center/inventoryDays.js';
describe('inventoryDays trend', () => {
    it('emits one point per complete snapshot row with no gap-filling', () => {
        const rows = [
            {
                snapshotKey: '20260601_080000',
                snapshotDate: '2026-06-01',
                inventoryValue: 300,
                ytdCogs: 100,
                inventoryDays: null,
                itr: null,
            },
            {
                snapshotKey: '20260615_080000',
                snapshotDate: '2026-06-15',
                inventoryValue: 350,
                ytdCogs: 120,
                inventoryDays: null,
                itr: null,
            },
            {
                snapshotKey: '20260623_071701',
                snapshotDate: '2026-06-23',
                inventoryValue: 366.49,
                ytdCogs: 161.87,
                inventoryDays: null,
                itr: null,
            },
        ];
        const inventoryDays = buildTrendPointsFromMetricsRows(rows);
        expect(inventoryDays).toHaveLength(3);
        expect(inventoryDays.map((point) => point.snapshotKey)).toEqual([
            '20260601_080000',
            '20260615_080000',
            '20260623_071701',
        ]);
        expect(inventoryDays.map((point) => point.snapshotDate)).toEqual([
            '2026-06-01',
            '2026-06-15',
            '2026-06-23',
        ]);
        expect(inventoryDays[2]?.value).toBe(190.2);
    });
    it('skips snapshots missing inventory or COGS instead of interpolating', () => {
        const inventoryDays = buildTrendPointsFromMetricsRows([
            {
                snapshotKey: '20260601_080000',
                snapshotDate: '2026-06-01',
                inventoryValue: 300,
                ytdCogs: null,
                inventoryDays: null,
                itr: null,
            },
            {
                snapshotKey: '20260623_071701',
                snapshotDate: '2026-06-23',
                inventoryValue: 366.49,
                ytdCogs: 161.87,
                inventoryDays: null,
                itr: null,
            },
        ]);
        expect(inventoryDays).toHaveLength(1);
        expect(inventoryDays[0]?.snapshotKey).toBe('20260623_071701');
    });
    it('uses precomputed stored inventoryDays when present', () => {
        const inventoryDays = buildTrendPointsFromMetricsRows([
            {
                snapshotKey: '20260623_071701',
                snapshotDate: '2026-06-23',
                inventoryValue: 366.49,
                ytdCogs: 161.87,
                inventoryDays: 175.5,
                itr: 2.08,
            },
        ]);
        expect(inventoryDays).toHaveLength(1);
        expect(inventoryDays[0]?.value).toBe(175.5);
    });
});
