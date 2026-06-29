import { calendarMonthStart, financialQuarterStartDate, } from './copqPeriods.js';
import { financialYearStartDate } from '../command-center/inventoryDays.js';
import { CopqAnalyticsService } from './CopqAnalyticsService.js';
import { loadCopqDataSourceContext } from './copqNcParseConfig.js';
function asRecord(value) {
    return value && typeof value === 'object' ? { ...value } : {};
}
function metadataString(metadata, key) {
    if (!metadata || typeof metadata !== 'object')
        return null;
    const value = metadata[key];
    return typeof value === 'string' && value ? value : null;
}
function isWithinInclusive(dateKey, startKey, endKey) {
    return dateKey >= startKey && dateKey <= endKey;
}
function sumCopq(records) {
    return records.reduce((sum, record) => sum + record.finalCopq, 0);
}
function roundCurrency(value) {
    return Number(value.toFixed(2));
}
function pctOf(value, total) {
    if (total <= 0)
        return 0;
    return Number(((value / total) * 100).toFixed(1));
}
function monthKey(dateKey) {
    return dateKey.slice(0, 7);
}
function monthLabel(month) {
    const [year, monthNum] = month.split('-').map(Number);
    if (!year || !monthNum)
        return month;
    return new Date(Date.UTC(year, monthNum - 1, 1)).toLocaleDateString('en-IN', {
        month: 'short',
        year: 'numeric',
    });
}
function aggregateByField(records, field) {
    const map = new Map();
    for (const record of records) {
        const key = record[field];
        const bucket = map.get(key) ?? [];
        bucket.push(record);
        map.set(key, bucket);
    }
    return map;
}
export function buildCopqDrilldownAnalytics(records, referenceDate, totalCopqYtd) {
    const monthStart = calendarMonthStart(referenceDate);
    const quarterStart = financialQuarterStartDate(referenceDate);
    const financialYearStart = financialYearStartDate(referenceDate);
    const referenceKey = referenceDate.slice(0, 10);
    const mtdRecords = monthStart
        ? records.filter((record) => isWithinInclusive(record.ncDate, monthStart, referenceKey))
        : [];
    const qtdRecords = quarterStart
        ? records.filter((record) => isWithinInclusive(record.ncDate, quarterStart, referenceKey))
        : [];
    const ytdRecords = financialYearStart
        ? records.filter((record) => isWithinInclusive(record.ncDate, financialYearStart, referenceKey))
        : records;
    const denominator = totalCopqYtd ?? sumCopq(ytdRecords);
    const categoryKeys = new Set();
    for (const record of records)
        categoryKeys.add(record.category);
    const categoryBreakdown = [...categoryKeys]
        .map((category) => {
        const mtd = sumCopq(mtdRecords.filter((record) => record.category === category));
        const qtd = sumCopq(qtdRecords.filter((record) => record.category === category));
        const ytd = sumCopq(ytdRecords.filter((record) => record.category === category));
        return {
            category,
            mtd: roundCurrency(mtd),
            qtd: roundCurrency(qtd),
            ytd: roundCurrency(ytd),
            pctOfTotal: pctOf(ytd, denominator),
        };
    })
        .filter((row) => row.ytd > 0 || row.qtd > 0 || row.mtd > 0)
        .sort((a, b) => b.ytd - a.ytd);
    const topContributors = [...records]
        .sort((a, b) => b.finalCopq - a.finalCopq)
        .slice(0, 10)
        .map((record) => ({
        ncNumber: record.ncNumber,
        date: record.displayDate,
        product: record.product,
        department: record.department,
        rootCause: record.rootCause,
        finalCopq: roundCurrency(record.finalCopq),
        status: record.status,
    }));
    const byDepartment = [...aggregateByField(ytdRecords, 'department').entries()]
        .map(([department, deptRecords]) => {
        const totalCopq = sumCopq(deptRecords);
        return {
            department,
            ncCount: deptRecords.length,
            totalCopq: roundCurrency(totalCopq),
            avgCopq: deptRecords.length > 0 ? roundCurrency(totalCopq / deptRecords.length) : 0,
            pctContribution: pctOf(totalCopq, denominator),
        };
    })
        .sort((a, b) => b.totalCopq - a.totalCopq);
    const byProduct = [...aggregateByField(ytdRecords, 'product').entries()]
        .map(([product, productRecords]) => ({
        product,
        ncCount: productRecords.length,
        totalCopq: roundCurrency(sumCopq(productRecords)),
    }))
        .sort((a, b) => b.totalCopq - a.totalCopq);
    const monthlyMap = new Map();
    for (const record of records) {
        const key = monthKey(record.ncDate);
        const bucket = monthlyMap.get(key) ?? [];
        bucket.push(record);
        monthlyMap.set(key, bucket);
    }
    const monthlyTrend = [...monthlyMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([month, monthRecords]) => {
        const copq = sumCopq(monthRecords);
        const beforeQaClearance = monthRecords.reduce((sum, record) => {
            const before = record.beforeQaCopq ?? record.finalCopq;
            return sum + before;
        }, 0);
        const qaSaved = monthRecords.reduce((sum, record) => {
            if (record.beforeQaCopq == null)
                return sum;
            return sum + Math.max(0, record.beforeQaCopq - record.finalCopq);
        }, 0);
        const hasBeforeQa = monthRecords.some((record) => record.beforeQaCopq != null);
        return {
            month,
            monthLabel: monthLabel(month),
            copq: roundCurrency(copq),
            qaSaved: hasBeforeQa ? roundCurrency(qaSaved) : null,
            beforeQaClearance: hasBeforeQa ? roundCurrency(beforeQaClearance) : null,
        };
    });
    return {
        categoryBreakdown,
        topContributors,
        byDepartment,
        byProduct,
        monthlyTrend,
    };
}
async function loadNcAnalyticsContextFromFacts(metadata, dataSourceId) {
    const loaded = await CopqAnalyticsService.loadFactsIfAvailable(dataSourceId);
    if (!loaded?.meta)
        return null;
    const referenceDate = metadataString(metadata, 'copqReferenceDate')
        ?? loaded.meta.referenceDate;
    return {
        records: loaded.records,
        referenceDate: referenceDate.slice(0, 10),
        financialYearStart: loaded.meta.financialYearStart,
        monthStart: loaded.meta.monthStart,
        quarterStart: loaded.meta.quarterStart,
        sheetName: loaded.meta.sheetName
            ?? metadataString(metadata, 'ncRecordsSheetName'),
        sourceWorkbook: loaded.meta.sourceWorkbook
            ?? metadataString(metadata, 'sourceWorkbookName'),
        lastUpdated: loaded.meta.lastUpdated
            ?? metadataString(metadata, 'sourceLastUpdatedAt'),
    };
}
export async function loadNcAnalyticsContext(metadata) {
    const sourceContext = await loadCopqDataSourceContext();
    if (!sourceContext)
        return null;
    return loadNcAnalyticsContextFromFacts(metadata, sourceContext.dataSourceId);
}
