import type { ParsedFilename, RevenueProductGroupPayload } from '../types.js';
import { num, parseCsvRows, pct } from './utils.js';

export function processRevenueProductGroup(content: string, _meta: ParsedFilename): RevenueProductGroupPayload {
  const rows = parseCsvRows(content).map((row) => ({
    code: row['Group Code'] ?? '',
    name: row['Item Group'] ?? '',
    mtdQty: num(row['MTD Quantity']),
    mtdAmount: num(row['MTD Sales Amount']),
    qtdQty: num(row['QTD Quantity']),
    qtdAmount: num(row['QTD Sales Amount']),
    ytdQty: num(row['YTD Quantity']),
    ytdAmount: num(row['YTD Sales Amount']),
    ytdGrossProfit: num(row['YTD Gross Profit']),
    ytdGpPct: num(row['YTD GP %']),
    contributionPct: 0,
  }));

  const totalYtd = rows.reduce((sum, row) => sum + row.ytdAmount, 0);
  for (const row of rows) row.contributionPct = pct(row.ytdAmount, totalYtd);

  return { rows, totalYtd };
}
