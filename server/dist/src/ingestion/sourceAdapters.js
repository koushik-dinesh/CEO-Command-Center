import { calculateCopqPeriodTotals } from '../copq/copqPeriods.js';
import { parseNcCopqRecords } from '../copq/ncRecords.js';
import { parseSourceDate } from '../utils/dates.js';
import { toDecimal } from '../utils/numbers.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';
function readString(row, column) {
    if (!column)
        return undefined;
    const value = row[column];
    if (value === null || value === undefined || value === '')
        return undefined;
    return String(value).trim();
}
function readDecimalString(row, column) {
    const rawValue = readString(row, column);
    if (!rawValue)
        return undefined;
    const decimal = toDecimal(rawValue);
    return decimal?.toString();
}
function configFor(source) {
    return source.configJson;
}
function normalizeRevenueRows(source, rows, context) {
    const config = configFor(source);
    const accepted = [];
    const rejected = [];
    const mappings = config.columns;
    const sourceDate = context.sourceDate ?? new Date();
    rows.forEach((row, index) => {
        const revenueMtd = readDecimalString(row, mappings.revenueMtd);
        const revenueQtd = readDecimalString(row, mappings.revenueQtd);
        const revenueYtd = readDecimalString(row, mappings.revenueYtd);
        if (revenueMtd === undefined || revenueQtd === undefined || revenueYtd === undefined) {
            rejected.push({ rowNumber: index + 2, reason: 'Missing or invalid MTD/QTD/YTD revenue columns', raw: row });
            return;
        }
        const sourceKey = readString(row, mappings.sourceKey);
        accepted.push({
            sourceDate,
            sourceKey,
            normalized: {
                customerGroupCode: sourceKey ?? '',
                customerGroupName: readString(row, mappings.sourceName) ?? '',
                revenueMtd,
                revenueQtd,
                revenueYtd,
                revenue: revenueYtd,
                sourceFileName: context.sourceFileName ?? '',
                sourceLastUpdatedAt: sourceDate.toISOString(),
            },
            raw: row,
        });
    });
    return { accepted, rejected };
}
function readDashboardCell(row, cellName) {
    const cells = row.cells;
    if (!cells || typeof cells !== 'object')
        return null;
    const cell = cells[cellName];
    return cell && typeof cell === 'object' ? cell : null;
}
function referenceDateKey(row, context) {
    const workbookModified = typeof row.workbookModifiedTime === 'string' ? row.workbookModifiedTime : null;
    const parsedWorkbookDate = workbookModified ? parseSourceDate(workbookModified) : null;
    const sourceDate = parsedWorkbookDate ?? context.sourceDate ?? new Date();
    return sourceDate.toISOString().slice(0, 10);
}
function normalizeCopqDashboardRows(source, rows, context) {
    const accepted = [];
    const rejected = [];
    const config = configFor(source);
    const totalCopqCellRef = config.totalCopqCell ?? 'O34';
    rows.forEach((row, index) => {
        const totalCopqCell = readDashboardCell(row, 'totalCopq');
        const copqCell = readDashboardCell(row, 'copqBeforeQaClearance');
        const qaSavedCell = readDashboardCell(row, 'qaSavedAmount');
        const totalCopq = toDecimal(totalCopqCell?.effectiveValue);
        const copqBeforeQaClearance = toDecimal(copqCell?.effectiveValue);
        if (!totalCopqCell || !totalCopq || !copqCell || !copqBeforeQaClearance) {
            logO34Stage('NORMALIZED O34 REJECTED', {
                totalCopqCell,
                totalCopq: totalCopq?.toString() ?? null,
                copqCellRef: copqCell?.ref ?? null,
                rowCellKeys: row.cells && typeof row.cells === 'object' ? Object.keys(row.cells) : [],
            }, row);
            rejected.push({ rowNumber: index + 1, reason: 'Missing or invalid COPQ Dashboard cell values (TOTAL COPQ O34 required)', raw: row });
            return;
        }
        const headlineCellRef = totalCopqCell.ref ?? totalCopqCellRef;
        const qaSavedAmount = toDecimal(qaSavedCell?.effectiveValue);
        const sheetName = typeof row.sheetName === 'string' ? row.sheetName : 'Dashboard';
        const workbookName = typeof row.workbookName === 'string' ? row.workbookName : context.sourceFileName ?? '';
        const referenceDate = referenceDateKey(row, context);
        const ncRecordsPayload = row.ncRecords;
        const ncValues = ncRecordsPayload && typeof ncRecordsPayload === 'object'
            ? ncRecordsPayload.values ?? []
            : [];
        const parsedNcRecords = parseNcCopqRecords(ncValues, {
            copqColumn: config.ncCopqColumn ?? 'FINAL COPQ',
            dateColumn: config.ncDateColumn ?? 'NC DATE',
            dateColumnFallbacks: config.ncDateColumnFallbacks ?? ['Timestamp'],
            sourceKeyColumn: config.ncSourceKeyColumn ?? 'NC Number',
        });
        const periodTotals = calculateCopqPeriodTotals(parsedNcRecords.records, referenceDate);
        const copqYtd = totalCopq.toString();
        const copqMtd = periodTotals ? String(periodTotals.copqMtd) : '';
        const copqQtd = periodTotals ? String(periodTotals.copqQtd) : '';
        accepted.push({
            sourceDate: context.sourceDate ?? new Date(),
            sourceKey: `${sheetName}!${headlineCellRef}`,
            normalized: {
                copqCost: copqYtd,
                totalCopq: copqYtd,
                copqValue: copqYtd,
                copqYtd,
                copqMtd,
                copqQtd,
                copqBeforeQaClearance: copqBeforeQaClearance.toString(),
                qaSavedAmount: qaSavedAmount?.toString() ?? '',
                sourceWorkbookName: workbookName,
                sourceSheetName: sheetName,
                sourceCell: headlineCellRef,
                sourceCellFormula: totalCopqCell.formula ?? '',
                sourceCellValueType: totalCopqCell.valueType ?? '',
                copqBeforeQaClearanceCell: copqCell.ref ?? '',
                copqBeforeQaClearanceFormula: copqCell.formula ?? '',
                sourceWorkbookModifiedTime: typeof row.workbookModifiedTime === 'string' ? row.workbookModifiedTime : '',
                sourceLastUpdatedAt: typeof row.workbookModifiedTime === 'string' ? row.workbookModifiedTime : (context.sourceDate ?? new Date()).toISOString(),
                qaSavedAmountCell: qaSavedCell?.ref ?? '',
                qaSavedAmountFormula: qaSavedCell?.formula ?? '',
                ncRecordsSheetName: parsedNcRecords.records.length > 0 || ncValues.length > 0
                    ? String(ncRecordsPayload?.sheetName ?? config.ncRecordsSheetName ?? 'Form Responses 1')
                    : '',
                ncDateColumnUsed: parsedNcRecords.dateColumnUsed,
                ncCopqColumnUsed: parsedNcRecords.copqColumnUsed,
                copqReferenceDate: referenceDate,
                copqFinancialYearStart: periodTotals?.financialYearStart ?? '',
                copqQuarterStart: periodTotals?.quarterStart ?? '',
                copqMonthStart: periodTotals?.monthStart ?? '',
                copqMtdRowCount: periodTotals ? String(periodTotals.mtdRowCount) : '0',
                copqQtdRowCount: periodTotals ? String(periodTotals.qtdRowCount) : '0',
                copqFyRowCount: periodTotals ? String(periodTotals.fyRowCount) : '0',
                copqMtdSourceKeys: periodTotals?.mtdSourceKeys.join(',') ?? '',
                copqQtdSourceKeys: periodTotals?.qtdSourceKeys.join(',') ?? '',
                copqFySourceKeys: periodTotals?.fySourceKeys.join(',') ?? '',
                copqFyCalculatedTotal: periodTotals
                    ? parsedNcRecords.records
                        .filter((record) => record.ncDate >= (periodTotals.financialYearStart) && record.ncDate <= referenceDate)
                        .reduce((sum, record) => sum + record.finalCopq, 0)
                        .toFixed(4)
                    : '',
            },
            raw: row,
        });
        const normalizedRecord = accepted[accepted.length - 1].normalized;
        logO34Stage('NORMALIZED O34', normalizedRecord.totalCopq, normalizedRecord);
    });
    return { accepted, rejected };
}
function normalizeGenericRows(source, rows) {
    const config = configFor(source);
    const accepted = [];
    const rejected = [];
    rows.forEach((row, index) => {
        const sourceDate = parseSourceDate(row[config.dateColumn ?? '']);
        if (!sourceDate) {
            rejected.push({ rowNumber: index + 2, reason: `Invalid date column ${config.dateColumn}`, raw: row });
            return;
        }
        const normalized = {};
        const mappings = config.columns;
        for (const key of ['revenue', 'cogs', 'inventoryValue', 'copqCost', 'hrCost']) {
            const value = readDecimalString(row, mappings[key]);
            if (value !== undefined)
                normalized[key] = value;
        }
        const hasMetric = Object.keys(normalized).length > 0;
        if (!hasMetric) {
            rejected.push({ rowNumber: index + 2, reason: 'No valid KPI metric columns found', raw: row });
            return;
        }
        const sourceKey = readString(row, mappings.sourceKey);
        accepted.push({ sourceDate, sourceKey, normalized, raw: row });
    });
    return { accepted, rejected };
}
export function normalizeRows(source, rows, context = {}) {
    if (source.code === 'REVENUE_CSV') {
        return normalizeRevenueRows(source, rows, context);
    }
    if (source.code === 'COPQ_DASHBOARD_SHEET') {
        return normalizeCopqDashboardRows(source, rows, context);
    }
    return normalizeGenericRows(source, rows);
}
