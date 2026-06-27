import { num, parseCsvRows } from './utils.js';
function isDead(status) {
    return /dead/i.test(status);
}
function isSlow(status) {
    return /slow/i.test(status);
}
function buildAgingBuckets(problemRows) {
    return [
        { label: '0-30 days', min: 0, max: 30 },
        { label: '31-90 days', min: 31, max: 90 },
        { label: '91-180 days', min: 91, max: 180 },
        { label: '180+ days', min: 181, max: Infinity },
    ].map((bucket) => {
        const matches = problemRows.filter((row) => row.daysIdle >= bucket.min && row.daysIdle <= bucket.max);
        return {
            label: bucket.label,
            value: matches.reduce((sum, row) => sum + row.stockValue, 0),
            count: matches.length,
        };
    });
}
export function processDeadSlowStock(content, _meta) {
    const rows = parseCsvRows(content).map((row) => ({
        itemNo: row['Item No.'] ?? '',
        description: row['Item Description'] ?? '',
        itemGroup: row['Item Group'] ?? '',
        qty: num(row['Total Qty In Stock']),
        unitCost: num(row['Unit Cost']),
        stockValue: num(row['Stock Value']),
        lastStockOutDate: row['Last_Stock_Out_Date'] ?? '',
        daysIdle: num(row['Days Idle']),
        status: row['Stock Status'] ?? '',
    }));
    let deadStockValue = 0;
    let slowMovingValue = 0;
    let activeValue = 0;
    let deadCount = 0;
    let slowCount = 0;
    let activeCount = 0;
    const problemRows = [];
    for (const row of rows) {
        if (isDead(row.status)) {
            deadStockValue += row.stockValue;
            deadCount += 1;
            problemRows.push(row);
        }
        else if (isSlow(row.status)) {
            slowMovingValue += row.stockValue;
            slowCount += 1;
            problemRows.push(row);
        }
        else {
            activeValue += row.stockValue;
            activeCount += 1;
        }
    }
    const totalValue = deadStockValue + slowMovingValue + activeValue;
    const problemPct = totalValue > 0 ? ((deadStockValue + slowMovingValue) / totalValue) * 100 : 0;
    const topProblemItems = [...problemRows].sort((a, b) => b.stockValue - a.stockValue).slice(0, 25);
    return {
        topProblemItems,
        deadStockValue,
        slowMovingValue,
        activeValue,
        deadCount,
        slowCount,
        activeCount,
        problemPct: Number(problemPct.toFixed(2)),
        agingBuckets: buildAgingBuckets(problemRows),
    };
}
