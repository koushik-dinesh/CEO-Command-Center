import { parseSourceDate } from '../utils/dates.js';
import { toDecimal } from '../utils/numbers.js';

export interface NcCopqRecord {
  sourceKey: string;
  ncDate: string;
  finalCopq: number;
}

export interface NcCopqAnalyticsRecord extends NcCopqRecord {
  ncNumber: string;
  displayDate: string;
  product: string;
  department: string;
  rootCause: string;
  category: string;
  status: string;
  beforeQaCopq: number | null;
}

export interface NcRecordsParseConfig {
  copqColumn: string;
  dateColumn: string;
  dateColumnFallbacks?: string[];
  sourceKeyColumn?: string;
  ncNumberColumn?: string;
  productColumn?: string;
  departmentColumn?: string;
  rootCauseColumn?: string;
  rootCauseFallbackColumn?: string;
  categoryColumn?: string;
  statusColumn?: string;
  beforeQaCopqColumn?: string;
}

export interface NcRecordsParseResult {
  records: NcCopqAnalyticsRecord[];
  headerRowIndex: number;
  dateColumnUsed: string;
  copqColumnUsed: string;
  rejectedRowCount: number;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((header) => normalizeHeader(header).toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate).toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function cellText(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text || text.toLowerCase() === 'na' || text.toLowerCase() === 'n/a') return '';
  return text;
}

function normalizeCategory(issueRelatedTo: string, department: string, qcType: string): string {
  const primary = issueRelatedTo.trim();
  if (primary && primary.toLowerCase() !== 'miscellaneous') {
    return primary
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (department) return department;
  if (qcType) return qcType;
  return 'Unclassified';
}

function parseNcDateKey(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(epoch + value * 86_400_000);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  const parsed = parseSourceDate(value);
  if (!parsed) return null;
  return parsed.toISOString().slice(0, 10);
}

function formatDisplayDate(value: unknown, dateKey: string): string {
  const parsed = parseSourceDate(value);
  if (parsed) {
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  if (year && month && day) {
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return dateKey;
}

function findHeaderRow(values: unknown[][]): number {
  for (let index = 0; index < Math.min(values.length, 5); index += 1) {
    const row = values[index];
    if (!Array.isArray(row)) continue;
    const joined = row.map((cell) => normalizeHeader(cell).toLowerCase()).join(' ');
    if (joined.includes('final copq') || joined.includes('copq')) return index;
  }
  return 0;
}

export function parseNcCopqRecords(values: unknown[][], config: NcRecordsParseConfig): NcRecordsParseResult {
  if (!values.length) {
    return {
      records: [],
      headerRowIndex: -1,
      dateColumnUsed: config.dateColumn,
      copqColumnUsed: config.copqColumn,
      rejectedRowCount: 0,
    };
  }

  const headerRowIndex = findHeaderRow(values);
  const headers = (values[headerRowIndex] ?? []).map((cell) => normalizeHeader(cell));
  const copqColumnIndex = headerIndex(headers, [config.copqColumn, 'FINAL COPQ', 'Final COPQ']);
  const dateCandidates = [config.dateColumn, ...(config.dateColumnFallbacks ?? []), 'Date', 'NC DATE', 'NC Date', 'Timestamp'];
  const dateColumnIndex = headerIndex(headers, dateCandidates);
  const sourceKeyColumnIndex = config.sourceKeyColumn
    ? headerIndex(headers, [config.sourceKeyColumn, 'QC NC number', 'NC Number', 'NC NO', 'NC No'])
    : headerIndex(headers, ['QC NC number', 'NC Number', 'NC NO', 'NC No']);
  const ncNumberColumnIndex = headerIndex(headers, [
    config.ncNumberColumn ?? 'QC NC number',
    'QC NC number',
    'NC Number',
    'NC NO',
    'NC No',
  ]);
  const productColumnIndex = headerIndex(headers, [config.productColumn ?? 'Product name', 'Product name', 'Product Name']);
  const departmentColumnIndex = headerIndex(headers, [config.departmentColumn ?? 'QC Location', 'QC Location']);
  const rootCauseColumnIndex = headerIndex(headers, [
    config.rootCauseColumn ?? 'Reason For Rejection',
    'Reason For Rejection',
    'Complaint name',
  ]);
  const rootCauseFallbackColumnIndex = headerIndex(headers, [
    config.rootCauseFallbackColumn ?? 'Complaint name',
    'Complaint name',
  ]);
  const categoryColumnIndex = headerIndex(headers, [config.categoryColumn ?? 'Issue Related to', 'Issue Related to']);
  const statusColumnIndex = headerIndex(headers, [config.statusColumn ?? 'Status', 'Status']);
  const qcTypeColumnIndex = headerIndex(headers, ['QC']);
  const beforeQaCopqColumnIndex = headerIndex(headers, [
    config.beforeQaCopqColumn ?? 'QC COPQ',
    'QC COPQ',
  ]);

  if (copqColumnIndex < 0 || dateColumnIndex < 0) {
    return {
      records: [],
      headerRowIndex,
      dateColumnUsed: dateColumnIndex >= 0 ? headers[dateColumnIndex] : config.dateColumn,
      copqColumnUsed: copqColumnIndex >= 0 ? headers[copqColumnIndex] : config.copqColumn,
      rejectedRowCount: Math.max(0, values.length - headerRowIndex - 1),
    };
  }

  const records: NcCopqAnalyticsRecord[] = [];
  let rejectedRowCount = 0;

  for (let rowIndex = headerRowIndex + 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    if (!Array.isArray(row)) {
      rejectedRowCount += 1;
      continue;
    }

    const ncDate = parseNcDateKey(row[dateColumnIndex]);
    const finalCopq = toDecimal(row[copqColumnIndex]);
    if (!ncDate || !finalCopq || finalCopq.isNegative()) {
      rejectedRowCount += 1;
      continue;
    }

    const sourceKeyRaw = sourceKeyColumnIndex >= 0 ? row[sourceKeyColumnIndex] : `row-${rowIndex + 1}`;
    const sourceKey = String(sourceKeyRaw ?? `row-${rowIndex + 1}`).trim() || `row-${rowIndex + 1}`;
    const ncNumberRaw = ncNumberColumnIndex >= 0 ? row[ncNumberColumnIndex] : sourceKey;
    const ncNumber = cellText(ncNumberRaw) || sourceKey;
    const product = productColumnIndex >= 0 ? cellText(row[productColumnIndex]) || 'Unspecified' : 'Unspecified';
    const department = departmentColumnIndex >= 0 ? cellText(row[departmentColumnIndex]) || 'Unassigned' : 'Unassigned';
    const rootCausePrimary = rootCauseColumnIndex >= 0 ? cellText(row[rootCauseColumnIndex]) : '';
    const rootCauseFallback = rootCauseFallbackColumnIndex >= 0 ? cellText(row[rootCauseFallbackColumnIndex]) : '';
    const rootCause = rootCausePrimary || rootCauseFallback || 'Not specified';
    const issueRelatedTo = categoryColumnIndex >= 0 ? cellText(row[categoryColumnIndex]) : '';
    const qcType = qcTypeColumnIndex >= 0 ? cellText(row[qcTypeColumnIndex]) : '';
    const category = normalizeCategory(issueRelatedTo, department, qcType);
    const status = statusColumnIndex >= 0 ? cellText(row[statusColumnIndex]) || 'Unknown' : 'Unknown';
    const beforeQaCopq = beforeQaCopqColumnIndex >= 0
      ? toDecimal(row[beforeQaCopqColumnIndex])?.toNumber() ?? null
      : null;

    records.push({
      sourceKey,
      ncDate,
      finalCopq: finalCopq.toNumber(),
      ncNumber,
      displayDate: formatDisplayDate(row[dateColumnIndex], ncDate),
      product,
      department,
      rootCause,
      category,
      status,
      beforeQaCopq: beforeQaCopq != null && beforeQaCopq > 0 ? beforeQaCopq : null,
    });
  }

  return {
    records,
    headerRowIndex,
    dateColumnUsed: headers[dateColumnIndex],
    copqColumnUsed: headers[copqColumnIndex],
    rejectedRowCount,
  };
}
