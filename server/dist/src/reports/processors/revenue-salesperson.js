import { num, parseCsvRows, pct } from './utils.js';
export function processRevenueSalesperson(content, _meta) {
    const rows = parseCsvRows(content).map((row) => ({
        name: row.Salesperson ?? '',
        code: row['Salesperson Code'] ?? '',
        mtd: num(row['MTD Revenue (?)']),
        qtd: num(row['QTD Revenue (?)']),
        ytd: num(row['YTD Revenue (?)']),
        contributionPct: 0,
    }));
    const totalYtd = rows.reduce((sum, row) => sum + row.ytd, 0);
    for (const row of rows)
        row.contributionPct = pct(row.ytd, totalYtd);
    return { rows, totalYtd, salespersonCount: rows.length };
}
