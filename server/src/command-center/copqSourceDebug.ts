import type { RowDataPacket } from 'mysql2';
import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
import { CopqAnalyticsService } from '../copq/CopqAnalyticsService.js';
import { CopqAnalyticsMetaRepository } from '../repositories/CopqAnalyticsMetaRepository.js';
import { KpiRepository } from '../repositories/KpiRepository.js';
import { NcCopqFactRepository } from '../repositories/NcCopqFactRepository.js';
import type { NcCopqAnalyticsRecord } from '../copq/ncRecords.js';
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
    copqAnalyticsMeta: {
      syncedAt: string | null;
      recordCount: number;
      headlineJson: Record<string, unknown> | null;
    } | null;
  };
  /** Retained for API compatibility; dashboard debug uses staged data only (no live Google fetch). */
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

function buildNcFactPreviewDataset(
  factPreview: NcCopqAnalyticsRecord[],
  factCount: number,
  normalized: Record<string, unknown>,
  ncSheet: string,
  fileName: string,
): CopqSourceDebugDataset {
  return {
    sourceName: 'NC Register rows (analytics facts)',
    fileName,
    sheetName: String(normalized.ncRecordsSheetName ?? ncSheet),
    range: null,
    headers: ['QC NC number', 'NC DATE', 'Product name', 'QC Location', 'Root Cause', 'FINAL COPQ', 'Status'],
    rowsPreview: factPreview.map((row) => [
      row.ncNumber,
      row.displayDate,
      row.product,
      row.department,
      row.rootCause,
      row.finalCopq,
      row.status,
    ]),
    rowCount: factCount,
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
  const dataSource = await queryOne<DataSourceDbRow & { id: string }>(
    `SELECT id, code, name, locationRef, configJson
     FROM data_sources
     WHERE code = 'COPQ_DASHBOARD_SHEET'
     LIMIT 1`,
  );

  const kpiLatest = await KpiRepository.latestValueByCode('COPQ');
  const copqMeta = dataSource
    ? await CopqAnalyticsMetaRepository.findByDataSourceId(dataSource.id)
    : null;

  const config = dataSource ? parseJsonField(dataSource.configJson) as Record<string, unknown> : {};
  const normalized = (copqMeta?.headlineJson ?? {}) as Record<string, unknown>;
  const raw: Record<string, unknown> = {};
  const metadata = (kpiLatest?.value.metadataJson ?? {}) as Record<string, unknown>;

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

  const sourceContext = await CopqAnalyticsService.loadDataSourceContext();
  const factCount = sourceContext
    ? await NcCopqFactRepository.countForDataSource(sourceContext.dataSourceId)
    : 0;
  const factPreview = factCount > 0 && sourceContext
    ? await NcCopqFactRepository.listPreview(sourceContext.dataSourceId, 20)
    : [];
  const ncRegisterFileName = String(raw.workbookName ?? dataSource?.name ?? 'Form Responses');

  if (factPreview.length > 0) {
    datasets.push(buildNcFactPreviewDataset(factPreview, factCount, normalized, ncSheet, ncRegisterFileName));
  }

  const o34Cell = dashboardCells.totalCopq ?? null;
  const t13Cell = dashboardCells.copqBeforeQaClearance ?? null;
  const t5Cell = dashboardCells.qaSavedAmount ?? null;

  const liveFetch: CopqSourceDebugPayload['liveFetch'] = {
    attempted: false,
    success: false,
    error: 'Live Google Sheets fetch disabled; use sync/ingestion to refresh staged data',
    workbookName: typeof raw.workbookName === 'string' ? raw.workbookName : null,
    workbookModifiedTime: typeof raw.workbookModifiedTime === 'string' ? raw.workbookModifiedTime : null,
    dashboardCells: Object.keys(dashboardCells).length > 0 ? dashboardCells : null,
    ncRecords: factPreview.length > 0
      ? buildNcFactPreviewDataset(factPreview, factCount, normalized, ncSheet, ncRegisterFileName)
      : null,
    normalizedPreview: Object.keys(normalized).length > 0
      ? Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, value == null ? '' : String(value)]))
      : null,
  };

  const mappings = {
    copqYtd: o34Cell
      ? mappingFromCell('COPQ YTD', dashboardSheet, o34Cell, 'Dashboard!O34 = Total COPQ')
      : mappingFromNormalized('COPQ YTD', dashboardSheet, { ...normalized, ...metadata }, 'copqYtd', {
        cell: String(config.totalCopqCell ?? 'O34'),
        notes: 'Falling back to staged KPI metadata because staged O34 cell was unavailable',
      }),
    copqMtd: mappingFromNormalized('COPQ MTD', ncSheet, normalized, 'copqMtd', {
      column: String(config.ncCopqColumn ?? 'FINAL COPQ'),
      dateColumn: String(normalized.ncDateColumnUsed ?? config.ncDateColumn ?? 'NC DATE'),
      filter: normalized.copqMonthStart && normalized.copqReferenceDate
        ? `${normalized.copqMonthStart} → ${normalized.copqReferenceDate}`
        : undefined,
      rowCount: Number(normalized.copqMtdRowCount ?? 0) || undefined,
      sourceKeys: typeof normalized.copqMtdSourceKeys === 'string' && normalized.copqMtdSourceKeys
        ? normalized.copqMtdSourceKeys.split(',')
        : undefined,
      notes: 'Sum of FINAL COPQ for NC rows in current month',
    }),
    copqQtd: mappingFromNormalized('COPQ QTD', ncSheet, normalized, 'copqQtd', {
      column: String(config.ncCopqColumn ?? 'FINAL COPQ'),
      dateColumn: String(normalized.ncDateColumnUsed ?? config.ncDateColumn ?? 'NC DATE'),
      filter: normalized.copqQuarterStart && normalized.copqReferenceDate
        ? `${normalized.copqQuarterStart} → ${normalized.copqReferenceDate}`
        : undefined,
      rowCount: Number(normalized.copqQtdRowCount ?? 0) || undefined,
      sourceKeys: typeof normalized.copqQtdSourceKeys === 'string' && normalized.copqQtdSourceKeys
        ? normalized.copqQtdSourceKeys.split(',')
        : undefined,
      notes: 'Sum of FINAL COPQ for NC rows in current financial quarter',
    }),
    qaSaved: t5Cell
      ? mappingFromCell('QA Saved', dashboardSheet, t5Cell, 'Dashboard!T5')
      : mappingFromNormalized('QA Saved', dashboardSheet, { ...normalized, ...metadata }, 'qaSavedAmount', {
        cell: String(config.qaSavedAmountCell ?? 'T5'),
      }),
    beforeQaClearance: t13Cell
      ? mappingFromCell('Before QA Clearance', dashboardSheet, t13Cell, 'Dashboard!T13 (supporting metric only)')
      : mappingFromNormalized('Before QA Clearance', dashboardSheet, { ...normalized, ...metadata }, 'copqBeforeQaClearance', {
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
      latestKpiValue: kpiLatest ? {
        valueDecimal: kpiLatest.value.valueDecimal,
        previousValueDecimal: kpiLatest.value.previousValueDecimal,
        calculatedAt: kpiLatest.value.calculatedAt.toISOString(),
        metadataJson: kpiLatest.value.metadataJson,
      } : null,
      copqAnalyticsMeta: copqMeta ? {
        syncedAt: copqMeta.syncedAt.toISOString(),
        recordCount: copqMeta.recordCount,
        headlineJson: copqMeta.headlineJson,
      } : null,
    },
    liveFetch,
    finalKpiCard,
  };
}
