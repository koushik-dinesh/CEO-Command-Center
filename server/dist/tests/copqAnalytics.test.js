import { describe, expect, it } from 'vitest';
import { buildCopqDrilldownAnalytics } from '../src/copq/copqAnalytics.js';
const records = [
    {
        sourceKey: 'NC-001',
        ncNumber: 'NC-001',
        ncDate: '2026-04-10',
        displayDate: '10 Apr 2026',
        product: 'Oxygen Sensor',
        department: 'IPQC OS',
        rootCause: 'Rusted cathode',
        category: 'Process',
        status: 'Closed',
        finalCopq: 100000,
        beforeQaCopq: 120000,
    },
    {
        sourceKey: 'NC-002',
        ncNumber: 'NC-002',
        ncDate: '2026-05-15',
        displayDate: '15 May 2026',
        product: 'Flow Sensor',
        department: 'IPQC Moulding Chennai',
        rootCause: 'Colour mark',
        category: 'Production moulding Chennai',
        status: 'Closed',
        finalCopq: 50000,
        beforeQaCopq: 70000,
    },
    {
        sourceKey: 'NC-003',
        ncNumber: 'NC-003',
        ncDate: '2026-06-05',
        displayDate: '5 Jun 2026',
        product: 'Flow Sensor',
        department: 'IPQC Moulding Chennai',
        rootCause: 'Black dot',
        category: 'Production moulding Chennai',
        status: 'Open',
        finalCopq: 30000,
        beforeQaCopq: null,
    },
    {
        sourceKey: 'NC-004',
        ncNumber: 'NC-004',
        ncDate: '2026-06-12',
        displayDate: '12 Jun 2026',
        product: 'Oxygen Sensor',
        department: 'FQC Chennai',
        rootCause: 'Shield short',
        category: 'Process',
        status: 'Closed',
        finalCopq: 20000,
        beforeQaCopq: 25000,
    },
];
describe('buildCopqDrilldownAnalytics', () => {
    it('builds category, contributor, department, product, and monthly analytics', () => {
        const analytics = buildCopqDrilldownAnalytics(records, '2026-06-18', 321762.59);
        expect(analytics.topContributors[0]?.ncNumber).toBe('NC-001');
        expect(analytics.topContributors).toHaveLength(4);
        const processCategory = analytics.categoryBreakdown.find((row) => row.category === 'Process');
        expect(processCategory?.ytd).toBe(120000);
        expect(processCategory?.mtd).toBe(20000);
        const mouldingDept = analytics.byDepartment.find((row) => row.department === 'IPQC Moulding Chennai');
        expect(mouldingDept?.ncCount).toBe(2);
        expect(mouldingDept?.totalCopq).toBe(80000);
        const flowSensor = analytics.byProduct.find((row) => row.product === 'Flow Sensor');
        expect(flowSensor?.ncCount).toBe(2);
        expect(flowSensor?.totalCopq).toBe(80000);
        expect(analytics.monthlyTrend.map((row) => row.month)).toEqual(['2026-04', '2026-05', '2026-06']);
        expect(analytics.monthlyTrend[0]?.copq).toBe(100000);
        expect(analytics.monthlyTrend[0]?.qaSaved).toBe(20000);
        expect(analytics.monthlyTrend[2]?.qaSaved).toBe(5000);
    });
});
