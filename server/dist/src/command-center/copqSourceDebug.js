import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
import { getLatestCopqStagingRecord } from '../copq/copqStagingQueries.js';
import { GoogleSheetsService } from '../ingestion/googleSheetsService.js';
import { sheetValuesToRows } from '../ingestion/csvParser.js';
import { normalizeRows } from '../ingestion/sourceAdapters.js';
import { toDecimal } from '../utils/numbers.js';
function parseCell(cell) {
    if (!cell?.ref)
        return null;
    const parsed = toDecimal(cell.effectiveValue);
    return {
        ref: cell.ref,
        raw: cell.effectiveValue ?? null,
        formatted: cell.formattedValue ?? null,
        parsed: parsed?.toString() ?? null,
        formula: cell.formula ?? null,
    };
}
function previewRows(values, limit = 20) {
    if (!values?.length)
        return { headers: [], rowsPreview: [], rowCount: 0 };
    const headers = (values[0] ?? []).map((cell) => String(cell ?? ''));
    const dataRows = values.slice(1);
    return {
        headers,
        rowsPreview: dataRows.slice(0, limit),
        rowCount: dataRows.length,
    };
}
function readCellMap(raw) {
    const cells = raw.cells;
    if (!cells || typeof cells !== 'object')
        return {};
    const output = {};
    for (const [key, value] of Object.entries(cells)) {
        const parsed = parseCell(value);
        if (parsed)
            output[key] = parsed;
    }
    return output;
}
function mappingFromCell(label, sheet, cell, notes) {
    return {
        label,
        sheet,
        cell: cell?.ref,
        rawValue: cell?.raw ?? cell?.formatted ?? null,
        parsedValue: cell?.parsed ?? null,
        notes,
    };
}
function mappingFromNormalized(label, sheet, normalized, valueKey, extra = {}) {
    const raw = normalized[valueKey];
    const parsed = raw == null || raw === '' ? null : String(raw);
    return {
        label,
        sheet,
        rawValue: raw ?? null,
        parsedValue: parsed,
        ...extra,
    };
}
export async function buildCopqSourceDebug(finalKpiCard) {
    const dataSource = await queryOne(`SELECT code, name, locationRef, configJson
     FROM data_sources
     WHERE code = 'COPQ_DASHBOARD_SHEET'
     LIMIT 1`);
    const staging = await getLatestCopqStagingRecord();
    const kpiValue = await queryOne(`SELECT kv.valueDecimal, kv.previousValueDecimal, kv.calculatedAt, kv.metadataJson
     FROM kpi_values kv
     INNER JOIN kpi_definitions kd ON kd.id = kv.kpiDefinitionId
     WHERE kd.code = 'COPQ'
     ORDER BY kv.calculatedAt DESC
     LIMIT 1`);
    const config = dataSource ? parseJsonField(dataSource.configJson) : {};
    const normalized = staging?.normalized ? staging.normalized : {};
    const raw = staging?.raw ? staging.raw : {};
    const metadata = kpiValue?.metadataJson ? parseJsonField(kpiValue.metadataJson) : {};
    const datasets = [];
    const dashboardSheet = String(config.dashboardSheetName ?? 'Dashboard');
    const ncSheet = String(config.ncRecordsSheetName ?? 'Form Responses 1');
    const dashboardCells = readCellMap(raw);
    if (Object.keys(dashboardCells).length > 0) {
        datasets.push({
            sourceName: 'NC Register Dashboard (staged)',
            fileName: String(raw.workbookName ?? dataSource?.name ?? 'COPQ Dashboard'),
            sheetName: dashboardSheet,
            range: typeof raw.range === 'string' ? raw.range : null,
            ...previewRows([]),
            cells: dashboardCells,
        });
    }
    const ncRecords = raw.ncRecords;
    if (ncRecords?.values?.length) {
        const preview = previewRows(ncRecords.values);
        datasets.push({
            sourceName: 'NC Register rows (staged)',
            fileName: String(raw.workbookName ?? dataSource?.name ?? 'Form Responses'),
            sheetName: ncRecords.sheetName ?? ncSheet,
            range: ncRecords.range ?? null,
            headers: preview.headers,
            rowsPreview: preview.rowsPreview,
            rowCount: preview.rowCount,
        });
    }
    const o34Cell = dashboardCells.totalCopq ?? null;
    const t13Cell = dashboardCells.copqBeforeQaClearance ?? null;
    const t5Cell = dashboardCells.qaSavedAmount ?? null;
    const liveFetch = {
        attempted: false,
        success: false,
        error: null,
        workbookName: null,
        workbookModifiedTime: null,
        dashboardCells: null,
        ncRecords: null,
        normalizedPreview: null,
    };
    if (dataSource) {
        liveFetch.attempted = true;
        try {
            const sourceRow = {
                ...dataSource,
                configJson: parseJsonField(dataSource.configJson),
                isActive: true,
            };
            const payload = await new GoogleSheetsService().fetchRange(sourceRow);
            const liveRaw = JSON.parse(payload.content);
            const liveCells = readCellMap(liveRaw);
            const liveNc = liveRaw.ncRecords;
            const livePreview = previewRows(liveNc?.values);
            const normalizedLive = normalizeRows(sourceRow, sheetValuesToRows(payload.content), { sourceDate: payload.modifiedTime ?? new Date(), sourceFileName: payload.fileName });
            liveFetch.success = true;
            liveFetch.workbookName = String(liveRaw.workbookName ?? payload.fileName);
            liveFetch.workbookModifiedTime = typeof liveRaw.workbookModifiedTime === 'string' ? liveRaw.workbookModifiedTime : null;
            liveFetch.dashboardCells = liveCells;
            liveFetch.ncRecords = liveNc?.values?.length ? {
                sourceName: 'NC Register rows (live)',
                fileName: String(liveRaw.workbookName ?? payload.fileName),
                sheetName: liveNc.sheetName ?? ncSheet,
                range: liveNc.range ?? null,
                headers: livePreview.headers,
                rowsPreview: livePreview.rowsPreview,
                rowCount: livePreview.rowCount,
            } : null;
            liveFetch.normalizedPreview = normalizedLive.accepted[0]?.normalized ?? null;
            datasets.push({
                sourceName: 'NC Register Dashboard (live)',
                fileName: String(liveRaw.workbookName ?? payload.fileName),
                sheetName: dashboardSheet,
                range: typeof liveRaw.range === 'string' ? liveRaw.range : null,
                ...previewRows([]),
                cells: liveCells,
            });
            if (liveFetch.ncRecords)
                datasets.push(liveFetch.ncRecords);
        }
        catch (error) {
            liveFetch.error = error instanceof Error ? error.message : String(error);
        }
    }
    const effectiveO34 = liveFetch.dashboardCells?.totalCopq ?? o34Cell;
    const effectiveT13 = liveFetch.dashboardCells?.copqBeforeQaClearance ?? t13Cell;
    const effectiveT5 = liveFetch.dashboardCells?.qaSavedAmount ?? t5Cell;
    const effectiveNormalized = liveFetch.normalizedPreview ?? normalized;
    const mappings = {
        copqYtd: effectiveO34
            ? mappingFromCell('COPQ YTD', dashboardSheet, effectiveO34, 'Dashboard!O34 = Total COPQ')
            : mappingFromNormalized('COPQ YTD', dashboardSheet, { ...effectiveNormalized, ...metadata }, 'copqYtd', {
                cell: String(config.totalCopqCell ?? 'O34'),
                notes: 'Falling back to staged KPI metadata because live/staged O34 cell was unavailable',
            }),
        copqMtd: mappingFromNormalized('COPQ MTD', ncSheet, effectiveNormalized, 'copqMtd', {
            column: String(config.ncCopqColumn ?? 'FINAL COPQ'),
            dateColumn: String(effectiveNormalized.ncDateColumnUsed ?? config.ncDateColumn ?? 'NC DATE'),
            filter: effectiveNormalized.copqMonthStart && effectiveNormalized.copqReferenceDate
                ? `${effectiveNormalized.copqMonthStart} → ${effectiveNormalized.copqReferenceDate}`
                : undefined,
            rowCount: Number(effectiveNormalized.copqMtdRowCount ?? 0) || undefined,
            sourceKeys: typeof effectiveNormalized.copqMtdSourceKeys === 'string' && effectiveNormalized.copqMtdSourceKeys
                ? effectiveNormalized.copqMtdSourceKeys.split(',')
                : undefined,
            notes: 'Sum of FINAL COPQ for NC rows in current month',
        }),
        copqQtd: mappingFromNormalized('COPQ QTD', ncSheet, effectiveNormalized, 'copqQtd', {
            column: String(config.ncCopqColumn ?? 'FINAL COPQ'),
            dateColumn: String(effectiveNormalized.ncDateColumnUsed ?? config.ncDateColumn ?? 'NC DATE'),
            filter: effectiveNormalized.copqQuarterStart && effectiveNormalized.copqReferenceDate
                ? `${effectiveNormalized.copqQuarterStart} → ${effectiveNormalized.copqReferenceDate}`
                : undefined,
            rowCount: Number(effectiveNormalized.copqQtdRowCount ?? 0) || undefined,
            sourceKeys: typeof effectiveNormalized.copqQtdSourceKeys === 'string' && effectiveNormalized.copqQtdSourceKeys
                ? effectiveNormalized.copqQtdSourceKeys.split(',')
                : undefined,
            notes: 'Sum of FINAL COPQ for NC rows in current financial quarter',
        }),
        qaSaved: effectiveT5
            ? mappingFromCell('QA Saved', dashboardSheet, effectiveT5, 'Dashboard!T5')
            : mappingFromNormalized('QA Saved', dashboardSheet, { ...effectiveNormalized, ...metadata }, 'qaSavedAmount', {
                cell: String(config.qaSavedAmountCell ?? 'T5'),
            }),
        beforeQaClearance: effectiveT13
            ? mappingFromCell('Before QA Clearance', dashboardSheet, effectiveT13, 'Dashboard!T13 (supporting metric only)')
            : mappingFromNormalized('Before QA Clearance', dashboardSheet, { ...effectiveNormalized, ...metadata }, 'copqBeforeQaClearance', {
                cell: String(config.copqCell ?? 'T13'),
            }),
    };
    return {
        generatedAt: new Date().toISOString(),
        dataSource: dataSource ? {
            code: dataSource.code,
            name: dataSource.name,
            locationRef: dataSource.locationRef,
            configJson: parseJsonField(dataSource.configJson),
        } : null,
        datasets,
        mappings,
        database: {
            latestKpiValue: kpiValue ? {
                valueDecimal: kpiValue.valueDecimal,
                previousValueDecimal: kpiValue.previousValueDecimal,
                calculatedAt: kpiValue.calculatedAt.toISOString(),
                metadataJson: parseJsonField(kpiValue.metadataJson),
            } : null,
            latestStaging: staging ? {
                createdAt: staging.createdAt.toISOString(),
                sourceKey: staging.sourceKey,
                normalized,
                rawType: typeof raw.type === 'string' ? raw.type : null,
            } : null,
        },
        liveFetch,
        finalKpiCard,
    };
}
