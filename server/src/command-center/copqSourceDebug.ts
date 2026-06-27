import type { RowDataPacket } from 'mysql2';
import type { DataSourceRow } from '../db/types.js';
import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
import { getLatestCopqStagingRecord } from '../copq/copqStagingQueries.js';
import { GoogleSheetsService } from '../ingestion/googleSheetsService.js';
import { sheetValuesToRows } from '../ingestion/csvParser.js';
import { normalizeRows } from '../ingestion/sourceAdapters.js';
import { toDecimal } from '../utils/numbers.js';
import type { KpiMetric } from './types.js';

export interface CopqSourceDebugCell {
  ref: string;
  raw: unknown;
  formatted: string | null;
  parsed: string | null;
  formula: string | null;
}

export interface CopqSourceDebugDataset {
  sourceName: string;
  fileName: string;
  sheetName: string | null;
  range: string | null;
  headers: string[];
  rowsPreview: unknown[][];
  rowCount: number;
  cells?: Record<string, CopqSourceDebugCell>;
}

export interface CopqSourceDebugMapping {
  label: string;
  sheet: string;
  cell?: string;
  column?: string;
  dateColumn?: string;
  filter?: string;
  rowCount?: number;
  sourceKeys?: string[];
  rawValue: unknown;
  parsedValue: string | null;
  notes?: string;
}

export interface CopqSourceDebugPayload {
  generatedAt: string;
  dataSource: {
    code: string;
    name: string;
    locationRef: string;
    configJson: unknown;
  } | null;
  datasets: CopqSourceDebugDataset[];
  mappings: {
    copqYtd: CopqSourceDebugMapping;
    copqMtd: CopqSourceDebugMapping;
    copqQtd: CopqSourceDebugMapping;
    qaSaved: CopqSourceDebugMapping;
    beforeQaClearance: CopqSourceDebugMapping;
  };
  database: {
    latestKpiValue: {
      valueDecimal: string | null;
      previousValueDecimal: string | null;
      calculatedAt: string | null;
      metadataJson: unknown;
    } | null;
    latestStaging: {
      createdAt: string | null;
      sourceKey: string | null;
      normalized: Record<string, unknown>;
      rawType: string | null;
    } | null;
  };
  liveFetch: {
    attempted: boolean;
    success: boolean;
    error: string | null;
    workbookName: string | null;
    workbookModifiedTime: string | null;
    dashboardCells: Record<string, CopqSourceDebugCell> | null;
    ncRecords: CopqSourceDebugDataset | null;
    normalizedPreview: Record<string, string> | null;
  };
  finalKpiCard: KpiMetric | null;
}

interface DataSourceDbRow extends RowDataPacket {
  code: string;
  name: string;
  locationRef: string;
  configJson: unknown;
}

interface KpiValueDbRow extends RowDataPacket {
  valueDecimal: string | null;
  previousValueDecimal: string | null;
  calculatedAt: Date;
  metadataJson: unknown;
}

function parseCell(cell: {
  ref?: string;
  effectiveValue?: unknown;
  formattedValue?: string | null;
  formula?: string | null;
} | null | undefined): CopqSourceDebugCell | null {
  if (!cell?.ref) return null;
  const parsed = toDecimal(cell.effectiveValue);
  return {
    ref: cell.ref,
    raw: cell.effectiveValue ?? null,
    formatted: cell.formattedValue ?? null,
    parsed: parsed?.toString() ?? null,
    formula: cell.formula ?? null,
  };
}

function previewRows(values: unknown[][] | undefined, limit = 20): { headers: string[]; rowsPreview: unknown[][]; rowCount: number } {
  if (!values?.length) return { headers: [], rowsPreview: [], rowCount: 0 };
  const headers = (values[0] ?? []).map((cell) => String(cell ?? ''));
  const dataRows = values.slice(1);
  return {
    headers,
    rowsPreview: dataRows.slice(0, limit),
    rowCount: dataRows.length,
  };
}

function readCellMap(raw: Record<string, unknown>): Record<string, CopqSourceDebugCell> {
  const cells = raw.cells;
  if (!cells || typeof cells !== 'object') return {};
  const output: Record<string, CopqSourceDebugCell> = {};
  for (const [key, value] of Object.entries(cells as Record<string, unknown>)) {
    const parsed = parseCell(value as { ref?: string; effectiveValue?: unknown; formattedValue?: string | null; formula?: string | null });
    if (parsed) output[key] = parsed;
  }
  return output;
}

function mappingFromCell(label: string, sheet: string, cell: CopqSourceDebugCell | null | undefined, notes?: string): CopqSourceDebugMapping {
  return {
    label,
    sheet,
    cell: cell?.ref,
    rawValue: cell?.raw ?? cell?.formatted ?? null,
    parsedValue: cell?.parsed ?? null,
    notes,
  };
}

function mappingFromNormalized(
  label: string,
  sheet: string,
  normalized: Record<string, unknown>,
  valueKey: string,
  extra: Partial<CopqSourceDebugMapping> = {},
): CopqSourceDebugMapping {
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

export async function buildCopqSourceDebug(finalKpiCard: KpiMetric | null): Promise<CopqSourceDebugPayload> {
  const dataSource = await queryOne<DataSourceDbRow>(
    `SELECT code, name, locationRef, configJson
     FROM data_sources
     WHERE code = 'COPQ_DASHBOARD_SHEET'
     LIMIT 1`,
  );

  const staging = await getLatestCopqStagingRecord();

  const kpiValue = await queryOne<KpiValueDbRow>(
    `SELECT kv.valueDecimal, kv.previousValueDecimal, kv.calculatedAt, kv.metadataJson
     FROM kpi_values kv
     INNER JOIN kpi_definitions kd ON kd.id = kv.kpiDefinitionId
     WHERE kd.code = 'COPQ'
     ORDER BY kv.calculatedAt DESC
     LIMIT 1`,
  );

  const config = dataSource ? parseJsonField(dataSource.configJson) as Record<string, unknown> : {};
  const normalized = staging?.normalized ? staging.normalized as Record<string, unknown> : {};
  const raw = staging?.raw ? staging.raw as Record<string, unknown> : {};
  const metadata = kpiValue?.metadataJson ? parseJsonField(kpiValue.metadataJson) as Record<string, unknown> : {};

  const datasets: CopqSourceDebugDataset[] = [];
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

  const ncRecords = raw.ncRecords as { sheetName?: string; range?: string; values?: unknown[][] } | undefined;
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

  const liveFetch: CopqSourceDebugPayload['liveFetch'] = {
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
      } as DataSourceRow;
      const payload = await new GoogleSheetsService().fetchRange(sourceRow);
      const liveRaw = JSON.parse(payload.content) as Record<string, unknown>;
      const liveCells = readCellMap(liveRaw);
      const liveNc = liveRaw.ncRecords as { sheetName?: string; range?: string; values?: unknown[][] } | undefined;
      const livePreview = previewRows(liveNc?.values);
      const normalizedLive = normalizeRows(
        sourceRow,
        sheetValuesToRows(payload.content),
        { sourceDate: payload.modifiedTime ?? new Date(), sourceFileName: payload.fileName },
      );

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
      if (liveFetch.ncRecords) datasets.push(liveFetch.ncRecords);
    } catch (error) {
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
