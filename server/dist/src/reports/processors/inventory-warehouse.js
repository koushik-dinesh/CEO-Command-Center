import { num, parseCsvRows, pct } from './utils.js';
export function processInventoryWarehouse(content, _meta) {
    const rows = parseCsvRows(content).map((row) => ({
        code: row['Warehouse Code'] ?? '',
        name: row['Warehouse Name'] ?? '',
        skuCount: num(row['No. of SKUs']),
        stockValue: num(row['Total Stock Value (?)']),
        contributionPct: num(row['% of Total Stock Value']),
    }));
    const totalValue = rows.reduce((sum, row) => sum + row.stockValue, 0);
    for (const row of rows) {
        if (!row.contributionPct)
            row.contributionPct = pct(row.stockValue, totalValue);
    }
    return { rows, totalValue, warehouseCount: rows.length };
}
