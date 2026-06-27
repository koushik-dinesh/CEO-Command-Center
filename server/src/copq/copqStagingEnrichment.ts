import type { RowDataPacket } from 'mysql2';
import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
import { calculateCopqPeriodTotals } from './copqPeriods.js';
import { isO34SourceCell, metadataDecimal, metadataString } from './copqKpiValue.js';
import { getLatestCopqStagingRecord } from './copqStagingQueries.js';
import { logO34Stage } from './o34PipelineTrace.js';
import { parseNcCopqRecords } from './ncRecords.js';
import { toDecimal } from '../utils/numbers.js';

interface DataSourceDbRow extends RowDataPacket {
  configJson: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
}

function hasO34Ytd(metadata: Record<string, unknown>): boolean {
  if (!isO34SourceCell(metadataString(metadata, 'sourceCell'))) return false;
  return metadataDecimal(metadata, 'copqYtd') != null || metadataDecimal(metadata, 'totalCopq') != null;
}

function applyO34Cell(
  enriched: Record<string, unknown>,
  cell: { ref?: string; effectiveValue?: unknown; formula?: string | null; valueType?: string } | null | undefined,
): boolean {
  const parsed = toDecimal(cell?.effectiveValue);
  if (!parsed) return false;
  const value = parsed.toString();
  enriched.totalCopq = value;
  enriched.copqYtd = value;
  enriched.sourceCell = cell?.ref ?? 'O34';
  if (cell?.formula) enriched.sourceCellFormula = cell.formula;
  if (cell?.valueType) enriched.sourceCellValueType = cell.valueType;
  return true;
}

export async function enrichCopqMetadataFromStaging(metadata: unknown): Promise<Record<string, unknown>> {
  const enriched = asRecord(metadata);
  const hasMtd = metadataDecimal(enriched, 'copqMtd') != null;
  const hasQtd = metadataDecimal(enriched, 'copqQtd') != null;
  const hasYtd = hasO34Ytd(enriched);

  if (hasMtd && hasQtd && hasYtd) return enriched;

  const staging = await getLatestCopqStagingRecord();
  if (!staging) {
    logO34Stage('STAGING O34 READ', { found: false, enrichedTotalCopq: enriched.totalCopq ?? null }, enriched);
    return enriched;
  }

  const normalized = asRecord(staging.normalized);
  const raw = asRecord(staging.raw);
  logO34Stage('STAGING O34', {
    normalizedTotalCopq: normalized.totalCopq ?? null,
    normalizedSourceCell: normalized.sourceCell ?? null,
    rawCellKeys: raw.cells && typeof raw.cells === 'object' ? Object.keys(raw.cells as Record<string, unknown>) : [],
    rawTotalCopq: raw.cells && typeof raw.cells === 'object'
      ? (raw.cells as { totalCopq?: unknown }).totalCopq ?? null
      : null,
  }, normalized);

  if (!hasYtd) {
    const rawCells = raw.cells as Record<string, unknown> | undefined;
    const totalCopqCell = rawCells?.totalCopq as { ref?: string; effectiveValue?: unknown; formula?: string | null; valueType?: string } | undefined;
    if (!applyO34Cell(enriched, totalCopqCell) && isO34SourceCell(metadataString(normalized, 'sourceCell'))) {
      if (normalized.totalCopq != null && normalized.totalCopq !== '') enriched.totalCopq = normalized.totalCopq;
      if (normalized.copqYtd != null && normalized.copqYtd !== '') enriched.copqYtd = normalized.copqYtd;
      enriched.sourceCell = normalized.sourceCell;
      if (normalized.sourceCellFormula) enriched.sourceCellFormula = normalized.sourceCellFormula;
      if (normalized.sourceCellValueType) enriched.sourceCellValueType = normalized.sourceCellValueType;
    }
    if (!metadataString(enriched, 'sourceWorkbookName') && normalized.sourceWorkbookName) {
      enriched.sourceWorkbookName = normalized.sourceWorkbookName;
    }
    if (!metadataString(enriched, 'sourceSheetName') && normalized.sourceSheetName) {
      enriched.sourceSheetName = normalized.sourceSheetName;
    }
  }

  if (hasMtd && hasQtd) {
    logO34Stage('STAGING O34 ENRICHED', {
      totalCopq: enriched.totalCopq ?? null,
      copqYtd: enriched.copqYtd ?? null,
      sourceCell: enriched.sourceCell ?? null,
    }, enriched);
    return enriched;
  }

  const ncRecords = raw.ncRecords as { values?: unknown[][] } | undefined;
  if (!ncRecords?.values?.length) {
    logO34Stage('STAGING O34 ENRICHED', {
      totalCopq: enriched.totalCopq ?? null,
      copqYtd: enriched.copqYtd ?? null,
      sourceCell: enriched.sourceCell ?? null,
    }, enriched);
    return enriched;
  }

  const dataSource = await queryOne<DataSourceDbRow>(
    `SELECT configJson FROM data_sources WHERE code = 'COPQ_DASHBOARD_SHEET' LIMIT 1`,
  );
  const config = dataSource ? asRecord(parseJsonField(dataSource.configJson)) : {};
  const referenceDate = metadataString(enriched, 'copqReferenceDate')
    ?? metadataString(normalized, 'copqReferenceDate')
    ?? new Date().toISOString().slice(0, 10);

  const parsed = parseNcCopqRecords(ncRecords.values, {
    copqColumn: String(config.ncCopqColumn ?? 'FINAL COPQ'),
    dateColumn: String(config.ncDateColumn ?? 'NC DATE'),
    dateColumnFallbacks: Array.isArray(config.ncDateColumnFallbacks)
      ? config.ncDateColumnFallbacks.map(String)
      : ['Timestamp'],
    sourceKeyColumn: String(config.ncSourceKeyColumn ?? 'NC Number'),
  });
  const totals = calculateCopqPeriodTotals(parsed.records, referenceDate);
  if (!totals) return enriched;

  if (!hasMtd) enriched.copqMtd = String(totals.copqMtd);
  if (!hasQtd) enriched.copqQtd = String(totals.copqQtd);
  if (!enriched.copqReferenceDate) enriched.copqReferenceDate = totals.referenceDate;
  if (!enriched.copqMonthStart) enriched.copqMonthStart = totals.monthStart;
  if (!enriched.copqQuarterStart) enriched.copqQuarterStart = totals.quarterStart;
  if (!enriched.copqMtdRowCount) enriched.copqMtdRowCount = String(totals.mtdRowCount);
  if (!enriched.copqQtdRowCount) enriched.copqQtdRowCount = String(totals.qtdRowCount);
  if (!enriched.copqMtdSourceKeys) enriched.copqMtdSourceKeys = totals.mtdSourceKeys.join(',');
  if (!enriched.copqQtdSourceKeys) enriched.copqQtdSourceKeys = totals.qtdSourceKeys.join(',');

  logO34Stage('STAGING O34 ENRICHED', {
    totalCopq: enriched.totalCopq ?? null,
    copqYtd: enriched.copqYtd ?? null,
    sourceCell: enriched.sourceCell ?? null,
  }, enriched);

  return enriched;
}
