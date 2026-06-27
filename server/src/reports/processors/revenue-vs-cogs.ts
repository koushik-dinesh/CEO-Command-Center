import type { ParsedFilename, RevenueVsCogsPayload } from '../types.js';
import { num, parseCsvRows } from './utils.js';

export function processRevenueVsCogs(content: string, _meta: ParsedFilename): RevenueVsCogsPayload {
  const rows = parseCsvRows(content).map((row) => ({
    type: row.Type ?? '',
    mtdRevenue: num(row['MTD Revenue']),
    mtdCogs: num(row['MTD COGS']),
    qtdRevenue: num(row['QTD Revenue']),
    qtdCogs: num(row['QTD COGS']),
    ytdRevenue: num(row['YTD Revenue']),
    ytdCogs: num(row['YTD COGS']),
    grossProfitPct: num(row['Gross Profit %']),
  }));

  const total = rows.find((row) => row.type.toUpperCase() === 'TOTAL') ?? null;
  return { rows: rows.filter((row) => row.type.toUpperCase() !== 'TOTAL'), total };
}
