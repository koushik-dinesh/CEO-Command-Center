import { parse } from 'csv-parse/sync';
import { Decimal } from 'decimal.js';
import { toDecimal } from '../utils/numbers.js';
const requiredColumns = ['Salesperson', 'Salesperson Code', 'YTD Revenue (?)'];
function assertRequiredColumns(row) {
    if (!row)
        throw new Error('Revenue Salesperson CSV is empty');
    const missing = requiredColumns.filter((column) => !(column in row));
    if (missing.length > 0)
        throw new Error(`Revenue Salesperson CSV is missing required columns: ${missing.join(', ')}`);
}
function decimalString(value) {
    return value.toDecimalPlaces(4).toString();
}
export function parseRevenueSalespersonCsv(content, sourceFile) {
    const rawRows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
    });
    assertRequiredColumns(rawRows[0]);
    const rowsWithRevenue = rawRows.map((row, index) => {
        const salespersonName = row.Salesperson?.trim();
        if (!salespersonName)
            throw new Error(`Revenue Salesperson CSV row ${index + 2} is missing Salesperson`);
        const revenue = toDecimal(row['YTD Revenue (?)']);
        if (!revenue)
            throw new Error(`Revenue Salesperson CSV row ${index + 2} has invalid YTD Revenue (?)`);
        return {
            salespersonName,
            salespersonCode: row['Salesperson Code']?.trim() || null,
            revenue,
        };
    });
    if (rowsWithRevenue.length === 0)
        throw new Error('Revenue Salesperson CSV has no salesperson rows');
    const totalRevenue = rowsWithRevenue.reduce((total, row) => total.plus(row.revenue), new Decimal(0));
    if (totalRevenue.equals(0))
        throw new Error('Revenue Salesperson CSV total revenue is zero');
    const rows = rowsWithRevenue
        .map((row) => ({
        salespersonName: row.salespersonName,
        salespersonCode: row.salespersonCode,
        revenueAmount: decimalString(row.revenue),
        contributionPercent: row.revenue.div(totalRevenue).mul(100).toDecimalPlaces(4).toString(),
    }))
        .sort((a, b) => new Decimal(b.revenueAmount).cmp(new Decimal(a.revenueAmount)));
    const topPerformers = rows.slice(0, 10);
    return {
        sourceFile,
        summary: {
            totalRevenue: decimalString(totalRevenue),
            salespersonCount: rows.length,
            averageRevenuePerSalesperson: decimalString(totalRevenue.div(rows.length)),
            highestRevenueContributor: rows[0] ?? null,
        },
        rows,
        topPerformers,
        chartData: rows.map((row) => ({ salespersonName: row.salespersonName, revenueAmount: row.revenueAmount })),
    };
}
