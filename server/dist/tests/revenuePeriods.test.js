import { describe, expect, it } from 'vitest';
import { extractRevenuePeriods } from '../src/command-center/insights.js';
describe('extractRevenuePeriods', () => {
    it('reads YTD, QTD, and MTD from Revenue vs COGS TOTAL row', () => {
        const revenueVsCogs = {
            rows: [],
            total: {
                type: 'TOTAL',
                mtdRevenue: 4280000,
                mtdCogs: 1000000,
                qtdRevenue: 11200000,
                qtdCogs: 3000000,
                ytdRevenue: 35000000,
                ytdCogs: 12000000,
                grossProfitPct: 65.7,
            },
        };
        const periods = extractRevenuePeriods({
            revenueVsCogs,
            salesperson: null,
            customerGroup: null,
            productGroup: null,
        });
        expect(periods.revenueYTD).toBe(35000000);
        expect(periods.revenueQTD).toBe(11200000);
        expect(periods.revenueMTD).toBe(4280000);
    });
    it('aggregates QTD and MTD from customer group when COGS TOTAL is zero', () => {
        const revenueVsCogs = {
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
        const periods = extractRevenuePeriods({
            revenueVsCogs,
            salesperson: null,
            customerGroup: {
                rows: [
                    { code: 'A', name: 'A', mtd: 100, qtd: 500, ytd: 2000, contributionPct: 50 },
                    { code: 'B', name: 'B', mtd: 200, qtd: 700, ytd: 3000, contributionPct: 50 },
                ],
                totalYtd: 5000,
            },
            productGroup: null,
        });
        expect(periods.revenueYTD).toBe(5000);
        expect(periods.revenueQTD).toBe(1200);
        expect(periods.revenueMTD).toBe(300);
    });
});
