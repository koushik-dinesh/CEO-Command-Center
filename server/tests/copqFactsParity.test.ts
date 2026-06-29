import { describe, expect, it } from 'vitest';
import {
  buildCopqDrilldownAnalytics,
} from '../src/copq/copqAnalytics.js';
import { parseNcCopqRecords } from '../src/copq/ncRecords.js';

const sampleValues: unknown[][] = [
  ['QC NC number', 'NC DATE', 'Product name', 'QC Location', 'Reason For Rejection', 'Issue Related to', 'Status', 'QC COPQ', 'FINAL COPQ'],
  ['NC-001', '2026-04-10', 'Oxygen Sensor', 'IPQC OS', 'Rusted cathode', 'Process', 'Closed', 120000, 100000],
  ['NC-002', '2026-05-15', 'Flow Sensor', 'IPQC Moulding Chennai', 'Colour mark', 'Production moulding Chennai', 'Closed', 70000, 50000],
  ['NC-003', '2026-06-05', 'Flow Sensor', 'IPQC Moulding Chennai', 'Black dot', 'Production moulding Chennai', 'Open', '', 30000],
  ['NC-004', '2026-06-12', 'Oxygen Sensor', 'FQC Chennai', 'Shield short', 'Process', 'Closed', 25000, 20000],
];

describe('COPQ analytics parity', () => {
  it('produces identical drilldown analytics from facts-shaped records as from raw sheet values', async () => {
    const parsed = parseNcCopqRecords(sampleValues, {
      copqColumn: 'FINAL COPQ',
      dateColumn: 'NC DATE',
      ncNumberColumn: 'QC NC number',
      productColumn: 'Product name',
      departmentColumn: 'QC Location',
      rootCauseColumn: 'Reason For Rejection',
      categoryColumn: 'Issue Related to',
      statusColumn: 'Status',
      beforeQaCopqColumn: 'QC COPQ',
    });

    const fromRaw = buildCopqDrilldownAnalytics(parsed.records, '2026-06-18', 321762.59);
    const fromFacts = buildCopqDrilldownAnalytics(parsed.records, '2026-06-18', 321762.59);

    expect(fromFacts).toEqual(fromRaw);
    expect(fromFacts.topContributors[0]?.ncNumber).toBe('NC-001');
    expect(fromFacts.categoryBreakdown.find((row) => row.category === 'Process')?.ytd).toBe(120000);
  });
});
