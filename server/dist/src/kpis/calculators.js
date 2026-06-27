import { KpiStatus } from '../db/types.js';
import { Decimal } from 'decimal.js';
import { toDecimal } from '../utils/numbers.js';
function records(context, sourceCodes) {
    return sourceCodes.flatMap((sourceCode) => context.recordsBySource.get(sourceCode) ?? []);
}
function sumMetric(context, sourceCodes, metric) {
    return records(context, sourceCodes).reduce((total, record) => {
        const value = toDecimal(record.normalized[metric]);
        return value ? total.plus(value) : total;
    }, new Decimal(0));
}
function current(value) {
    return { value, status: KpiStatus.CURRENT };
}
function unavailable(message) {
    return { value: null, status: KpiStatus.UNAVAILABLE, message };
}
const revenueMethodologyVersion = 'sales-revenue-customer-group-latest-file-ytd-v1';
function revenueTotals(context) {
    const allRevenueRecords = records(context, ['REVENUE_CSV']);
    const latestSourceDate = allRevenueRecords
        .map((record) => record.sourceDate)
        .sort((a, b) => b.getTime() - a.getTime())[0];
    const revenueRecords = latestSourceDate
        ? allRevenueRecords.filter((record) => record.sourceDate.getTime() === latestSourceDate.getTime())
        : [];
    const revenueMtd = revenueRecords.reduce((total, record) => {
        const value = toDecimal(record.normalized.revenueMtd);
        return value ? total.plus(value) : total;
    }, new Decimal(0));
    const revenueQtd = revenueRecords.reduce((total, record) => {
        const value = toDecimal(record.normalized.revenueQtd);
        return value ? total.plus(value) : total;
    }, new Decimal(0));
    const revenueYtd = revenueRecords.reduce((total, record) => {
        const value = toDecimal(record.normalized.revenueYtd);
        return value ? total.plus(value) : total;
    }, new Decimal(0));
    const sourceFileName = revenueRecords.find((record) => typeof record.normalized.sourceFileName === 'string')?.normalized.sourceFileName;
    const sourceLastUpdatedAt = revenueRecords
        .map((record) => record.sourceDate)
        .sort((a, b) => b.getTime() - a.getTime())[0]
        ?.toISOString();
    return { revenueRecords, revenueMtd, revenueQtd, revenueYtd, sourceFileName, sourceLastUpdatedAt, totalRevenueRowsAvailable: allRevenueRecords.length };
}
function latestRecord(context, sourceCode) {
    return [...(context.recordsBySource.get(sourceCode) ?? [])].sort((a, b) => b.sourceDate.getTime() - a.sourceDate.getTime())[0];
}
function inventorySnapshots(context) {
    const snapshots = new Map();
    for (const record of records(context, ['INVENTORY_CSV'])) {
        const value = toDecimal(record.normalized.inventoryValue);
        if (!value)
            continue;
        const day = record.sourceDate.toISOString().slice(0, 10);
        snapshots.set(day, (snapshots.get(day) ?? new Decimal(0)).plus(value));
    }
    return snapshots;
}
export const calculators = [
    {
        code: 'REVENUE',
        requiredSources: ['REVENUE_CSV'],
        calculate: (context) => {
            const totals = revenueTotals(context);
            if (totals.revenueRecords.length === 0 || totals.revenueYtd.equals(0)) {
                return unavailable('No production revenue rows available');
            }
            return {
                ...current(totals.revenueYtd),
                metadataJson: {
                    methodologyVersion: revenueMethodologyVersion,
                    methodologyDescription: 'Sales_Revenue_by_Customer_Group latest source file; Revenue_YTD is the primary CEO Revenue KPI.',
                    revenueMtd: totals.revenueMtd.toDecimalPlaces(4).toString(),
                    revenueQtd: totals.revenueQtd.toDecimalPlaces(4).toString(),
                    revenueYtd: totals.revenueYtd.toDecimalPlaces(4).toString(),
                    sourceFileName: totals.sourceFileName ?? null,
                    sourceLastUpdatedAt: totals.sourceLastUpdatedAt ?? null,
                    rowsAccepted: totals.revenueRecords.length,
                    totalRevenueRowsAvailable: totals.totalRevenueRowsAvailable,
                },
            };
        },
    },
    {
        code: 'INVENTORY_VALUE',
        requiredSources: ['INVENTORY_CSV'],
        calculate: (context) => {
            const snapshots = inventorySnapshots(context);
            const latestDay = [...snapshots.keys()].sort().at(-1);
            return latestDay ? current(snapshots.get(latestDay)) : unavailable('No inventory snapshot available');
        },
    },
    {
        code: 'COGS',
        requiredSources: ['SAP_EXPORT_CSV', 'REVENUE_CSV'],
        calculate: (context) => {
            const value = sumMetric(context, ['SAP_EXPORT_CSV', 'REVENUE_CSV'], 'cogs');
            return value.equals(0) ? unavailable('No COGS rows available') : current(value);
        },
    },
    {
        code: 'COPQ',
        requiredSources: ['COPQ_DASHBOARD_SHEET'],
        calculate: (context) => {
            const record = latestRecord(context, 'COPQ_DASHBOARD_SHEET');
            const sourceCell = String(record?.normalized.sourceCell ?? '');
            const totalCopq = toDecimal(record?.normalized.totalCopq ?? record?.normalized.copqYtd);
            const copqBeforeQaClearance = toDecimal(record?.normalized.copqBeforeQaClearance);
            if (!record || !totalCopq || !copqBeforeQaClearance) {
                return unavailable('No COPQ Dashboard sheet value available');
            }
            if (sourceCell.toUpperCase() !== 'O34' && !sourceCell.toUpperCase().endsWith('!O34')) {
                return unavailable('COPQ headline requires Dashboard!O34 (TOTAL COPQ)');
            }
            return {
                ...current(totalCopq),
                metadataJson: {
                    totalCopq: totalCopq.toDecimalPlaces(4).toString(),
                    copqValue: totalCopq.toDecimalPlaces(4).toString(),
                    copqYtd: totalCopq.toDecimalPlaces(4).toString(),
                    copqMtd: String(record.normalized.copqMtd ?? ''),
                    copqQtd: String(record.normalized.copqQtd ?? ''),
                    copqBeforeQaClearance: copqBeforeQaClearance.toDecimalPlaces(4).toString(),
                    qaSavedAmount: String(record.normalized.qaSavedAmount ?? ''),
                    sourceWorkbookName: String(record.normalized.sourceWorkbookName ?? ''),
                    sourceSheetName: String(record.normalized.sourceSheetName ?? ''),
                    sourceCell: String(record.normalized.sourceCell ?? ''),
                    sourceCellFormula: String(record.normalized.sourceCellFormula ?? ''),
                    sourceCellValueType: String(record.normalized.sourceCellValueType ?? ''),
                    copqBeforeQaClearanceCell: String(record.normalized.copqBeforeQaClearanceCell ?? ''),
                    copqBeforeQaClearanceFormula: String(record.normalized.copqBeforeQaClearanceFormula ?? ''),
                    sourceWorkbookModifiedTime: String(record.normalized.sourceWorkbookModifiedTime ?? ''),
                    sourceLastUpdatedAt: String(record.normalized.sourceLastUpdatedAt ?? record.normalized.sourceWorkbookModifiedTime ?? ''),
                    qaSavedAmountCell: String(record.normalized.qaSavedAmountCell ?? ''),
                    qaSavedAmountFormula: String(record.normalized.qaSavedAmountFormula ?? ''),
                    ncRecordsSheetName: String(record.normalized.ncRecordsSheetName ?? ''),
                    ncDateColumnUsed: String(record.normalized.ncDateColumnUsed ?? ''),
                    ncCopqColumnUsed: String(record.normalized.ncCopqColumnUsed ?? ''),
                    copqReferenceDate: String(record.normalized.copqReferenceDate ?? ''),
                    copqFinancialYearStart: String(record.normalized.copqFinancialYearStart ?? ''),
                    copqQuarterStart: String(record.normalized.copqQuarterStart ?? ''),
                    copqMonthStart: String(record.normalized.copqMonthStart ?? ''),
                    copqMtdRowCount: String(record.normalized.copqMtdRowCount ?? ''),
                    copqQtdRowCount: String(record.normalized.copqQtdRowCount ?? ''),
                    copqFyRowCount: String(record.normalized.copqFyRowCount ?? ''),
                    copqMtdSourceKeys: String(record.normalized.copqMtdSourceKeys ?? ''),
                    copqQtdSourceKeys: String(record.normalized.copqQtdSourceKeys ?? ''),
                    copqFySourceKeys: String(record.normalized.copqFySourceKeys ?? ''),
                    copqFyCalculatedTotal: String(record.normalized.copqFyCalculatedTotal ?? ''),
                },
            };
        },
    },
    {
        code: 'REVENUE_HR_COST_RATIO',
        requiredSources: ['REVENUE_CSV', 'SAP_EXPORT_CSV', 'HR_COST_SHEET'],
        calculate: (context) => {
            const revenue = sumMetric(context, ['REVENUE_CSV', 'SAP_EXPORT_CSV'], 'revenue');
            const hrCost = sumMetric(context, ['HR_COST_SHEET'], 'hrCost');
            if (revenue.equals(0))
                return unavailable('No revenue rows available');
            if (hrCost.equals(0))
                return unavailable('HR cost is missing or zero');
            return current(revenue.div(hrCost));
        },
    },
];
