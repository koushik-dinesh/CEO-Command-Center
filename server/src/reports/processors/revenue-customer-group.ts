import type { ParsedFilename, RevenueCustomerGroupPayload } from '../types.js';
import { num, parseCsvRows, pct } from './utils.js';

export function processRevenueCustomerGroup(content: string, _meta: ParsedFilename): RevenueCustomerGroupPayload {
  const rows = parseCsvRows(content).map((row) => ({
    code: row['Customer Group Code'] ?? '',
    name: row['Customer Group Name'] ?? '',
    mtd: num(row['MTD Revenue (?)']),
    qtd: num(row['QTD Revenue (?)']),
    ytd: num(row['YTD Revenue (?)']),
    contributionPct: num(row['% of Total Revenue']),
  }));

  const totalYtd = rows.reduce((sum, row) => sum + row.ytd, 0);
  for (const row of rows) {
    if (!row.contributionPct) row.contributionPct = pct(row.ytd, totalYtd);
  }

  return { rows, totalYtd };
}
