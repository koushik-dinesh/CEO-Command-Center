import { KpiStatus } from '../db/types.js';
import { Decimal } from 'decimal.js';
import { toDecimal } from '../utils/numbers.js';
import { revenuePeriodsFromSnapshot } from './snapshotKpiContext.js';
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
const snapshotRevenueMethodologyVersion = 'snapshot-metrics-latest-complete-ytd-v1';
function revenueFromSnapshot(context) {
    const snapshot = context.snapshotContext;
    if (!snapshot?.metrics.revenue)
        return null;
    const revenueYtd = new Decimal(snapshot.metrics.revenue);
    if (revenueYtd.equals(0))
        return null;
    const periods = revenuePeriodsFromSnapshot(snapshot);
    const revenueMtd = periods.revenueMTD != null ? new Decimal(periods.revenueMTD) : new Decimal(0);
    const revenueQtd = periods.revenueQTD != null ? new Decimal(periods.revenueQTD) : new Decimal(0);
    const fileNames = snapshot.metrics.fileNames;
    return {
        ...current(revenueYtd),
        metadataJson: {
            methodologyVersion: snapshotRevenueMethodologyVersion,
            methodologyDescription: 'Latest complete Drive snapshot metrics; Revenue_YTD from snapshot_metrics.',
            dataSource: 'snapshot_pipeline',
            snapshotKey: snapshot.metrics.snapshotKey,
            snapshotDate: snapshot.metrics.snapshotDate,
            revenueMtd: revenueMtd.toDecimalPlaces(4).toString(),
            revenueQtd: revenueQtd.toDecimalPlaces(4).toString(),
            revenueYtd: revenueYtd.toDecimalPlaces(4).toString(),
            sourceFileName: fileNames[0] ?? null,
            sourceLastUpdatedAt: snapshot.metrics.snapshotTimestamp.toISOString(),
            rowsAccepted: snapshot.metrics.reportCount,
        },
    };
}
function latestRecord(context, sourceCode) {
    return [...(context.recordsBySource.get(sourceCode) ?? [])].sort((a, b) => b.sourceDate.getTime() - a.sourceDate.getTime())[0];
}
export const calculators = [
    {
        code: 'REVENUE',
        requiredSources: [],
        calculate: (context) => {
            const fromSnapshot = revenueFromSnapshot(context);
            if (fromSnapshot)
                return fromSnapshot;
            return unavailable('No complete snapshot revenue metrics available');
        },
    },
    {
        code: 'INVENTORY_VALUE',
        requiredSources: [],
        calculate: (context) => {
            const snapshotValue = context.snapshotContext?.metrics.inventoryValue;
            if (snapshotValue != null) {
                return {
                    ...current(new Decimal(snapshotValue)),
                    metadataJson: {
                        dataSource: 'snapshot_pipeline',
                        snapshotKey: context.snapshotContext.metrics.snapshotKey,
                        snapshotDate: context.snapshotContext.metrics.snapshotDate,
                        sourceLastUpdatedAt: context.snapshotContext.metrics.snapshotTimestamp.toISOString(),
                    },
                };
            }
            return unavailable('No inventory snapshot metrics available');
        },
    },
    {
        code: 'COGS',
        requiredSources: [],
        calculate: (context) => {
            const snapshotCogs = context.snapshotContext?.metrics.ytdCogs;
            if (snapshotCogs != null) {
                const value = new Decimal(snapshotCogs);
                if (!value.equals(0)) {
                    return {
                        ...current(value),
                        metadataJson: {
                            dataSource: 'snapshot_pipeline',
                            snapshotKey: context.snapshotContext.metrics.snapshotKey,
                            snapshotDate: context.snapshotContext.metrics.snapshotDate,
                            sourceLastUpdatedAt: context.snapshotContext.metrics.snapshotTimestamp.toISOString(),
                        },
                    };
                }
            }
            return unavailable('No COGS snapshot metrics available');
        },
    },
    {
        code: 'COPQ',
        requiredSources: ['COPQ_DASHBOARD_SHEET'],
        calculate: (context) => {
            const headlineRecord = context.copqHeadline
                ? { normalized: context.copqHeadline, sourceDate: new Date() }
                : undefined;
            const record = headlineRecord ?? latestRecord(context, 'COPQ_DASHBOARD_SHEET');
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
        requiredSources: ['HR_COST_SHEET'],
        calculate: (context) => {
            const snapshotRevenue = context.snapshotContext?.metrics.revenue;
            if (snapshotRevenue == null)
                return unavailable('No snapshot revenue metrics available');
            const revenue = new Decimal(snapshotRevenue);
            const hrCost = sumMetric(context, ['HR_COST_SHEET'], 'hrCost');
            if (revenue.equals(0))
                return unavailable('No revenue rows available');
            if (hrCost.equals(0))
                return unavailable('HR cost is missing or zero');
            return {
                ...current(revenue.div(hrCost)),
                metadataJson: {
                    dataSource: 'snapshot_pipeline',
                    snapshotKey: context.snapshotContext.metrics.snapshotKey,
                    revenueYtd: String(snapshotRevenue),
                },
            };
        },
    },
];
