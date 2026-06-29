import 'dotenv/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '../.env') });

import { parseJsonField } from '../src/db/json.js';
import { closePool } from '../src/db/mysql.js';
import { GoogleSheetsService } from '../src/ingestion/googleSheetsService.js';
import { sheetValuesToRows } from '../src/ingestion/csvParser.js';
import { DataSourceRepository } from '../src/repositories/DataSourceRepository.js';
import { loadCopqDataSourceContext } from '../src/copq/copqNcParseConfig.js';
import { getLatestCopqStagingRecord } from '../src/copq/copqStagingQueries.js';
import { parseNcCopqRecords } from '../src/copq/ncRecords.js';

type FieldKey =
  | 'sourceKey'
  | 'ncNumber'
  | 'displayDate'
  | 'product'
  | 'department'
  | 'rootCause'
  | 'category'
  | 'status';

const CURRENT_LIMITS: Record<FieldKey, number> = {
  sourceKey: 191,
  ncNumber: 191,
  displayDate: 64,
  product: 191,
  department: 191,
  rootCause: 255,
  category: 191,
  status: 64,
};

const DEFAULT_COPQ_CONFIG: Record<string, unknown> = {
  dashboardSheetName: 'Overall Dashboard',
  ncRecordsSheetName: 'Form Responses 1',
  ncRecordsRange: "'Form Responses 1'!A:BC",
  ncDateColumn: 'NC DATE',
  ncDateColumnFallbacks: ['Timestamp'],
  ncCopqColumn: 'FINAL COPQ',
  ncSourceKeyColumn: 'QC NC number',
  ncNumberColumn: 'QC NC number',
  productColumn: 'Product name',
  departmentColumn: 'QC Location',
  rootCauseColumn: 'Reason For Rejection',
  rootCauseFallbackColumn: 'Complaint name',
  categoryColumn: 'Issue Related to',
  statusColumn: 'Status',
  beforeQaCopqColumn: 'QC COPQ',
};

const DEFAULT_SPREADSHEET_ID = '1V28mVxJtrqlzvaUTZAogAiI1PjKF4SjdJIGZotaC5vk';

function buildParseConfig(config: Record<string, unknown>) {
  return {
    copqColumn: String(config.ncCopqColumn ?? 'FINAL COPQ'),
    dateColumn: String(config.ncDateColumn ?? 'NC DATE'),
    dateColumnFallbacks: Array.isArray(config.ncDateColumnFallbacks)
      ? config.ncDateColumnFallbacks.map(String)
      : ['Timestamp', 'Date'],
    sourceKeyColumn: String(config.ncSourceKeyColumn ?? 'QC NC number'),
    ncNumberColumn: String(config.ncNumberColumn ?? 'QC NC number'),
    productColumn: String(config.productColumn ?? 'Product name'),
    departmentColumn: String(config.departmentColumn ?? 'QC Location'),
    rootCauseColumn: String(config.rootCauseColumn ?? 'Reason For Rejection'),
    rootCauseFallbackColumn: String(config.rootCauseFallbackColumn ?? 'Complaint name'),
    categoryColumn: String(config.categoryColumn ?? 'Issue Related to'),
    statusColumn: String(config.statusColumn ?? 'Status'),
    beforeQaCopqColumn: String(config.beforeQaCopqColumn ?? 'QC COPQ'),
  };
}

function analyzeField(records: Array<Record<FieldKey, string>>, field: FieldKey) {
  let maxLen = 0;
  let longest = '';

  for (const record of records) {
    const value = record[field] ?? '';
    const len = [...value].length;
    if (len > maxLen) {
      maxLen = len;
      longest = value;
    }
  }

  return {
    field,
    currentLimit: CURRENT_LIMITS[field],
    maxLength: maxLen,
    exceedsCurrent: maxLen > CURRENT_LIMITS[field],
    sampleCount: records.length,
    longestValue: longest,
  };
}

function recommendVarchar(maxLen: number, headroomPct = 25): number {
  const withHeadroom = Math.ceil(maxLen * (1 + headroomPct / 100));
  const tiers = [64, 128, 191, 255, 512, 1024];
  for (const tier of tiers) {
    if (withHeadroom <= tier) return tier;
  }
  return -1;
}

function recommendFieldLimit(maxLen: number): number | 'TEXT' {
  const recommended = recommendVarchar(maxLen);
  return recommended > 0 ? recommended : 'TEXT';
}

async function resolveParseConfig() {
  try {
    const sourceContext = await loadCopqDataSourceContext();
    if (sourceContext) return sourceContext;
  } catch {
    console.warn('Using default COPQ parse config (DB unavailable)');
  }
  return { config: DEFAULT_COPQ_CONFIG, parseConfig: buildParseConfig(DEFAULT_COPQ_CONFIG) };
}

async function loadNcValuesFromSheets(): Promise<unknown[][]> {
  const { google } = await import('googleapis');
  const { createGoogleAuth } = await import('../src/ingestion/googleAuth.js');
  const ncRecordsRange = String(DEFAULT_COPQ_CONFIG.ncRecordsRange ?? "'Form Responses 1'!A:BC");
  const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    range: ncRecordsRange,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = response.data.values ?? [];
  if (!values.length) throw new Error('Google Sheets returned no NC rows');
  console.log('Source: live Google Sheets NC register');
  return values;
}

async function loadNcValues(): Promise<unknown[][]> {
  try {
    const staging = await getLatestCopqStagingRecord();
    if (staging) {
      const raw = parseJsonField(staging.raw) as Record<string, unknown>;
      const ncRecords = raw.ncRecords as { values?: unknown[][] } | undefined;
      if (ncRecords?.values?.length) {
        console.log('Source: latest staging_records.raw.ncRecords');
        return ncRecords.values;
      }
    }
  } catch (error) {
    console.warn('DB unavailable, falling back to Google Sheets fetch:', error instanceof Error ? error.message : error);
  }

  const sources = await DataSourceRepository.activeSources().catch(() => []);
  const source = sources.find((candidate) => candidate.code === 'COPQ_DASHBOARD_SHEET');
  if (source) {
    const payload = await new GoogleSheetsService().fetchRange(source);
    const rows = sheetValuesToRows(payload.content);
    const row = rows[0] as Record<string, unknown> | undefined;
    const ncRecords = row?.ncRecords as { values?: unknown[][] } | undefined;
    if (ncRecords?.values?.length) {
      console.log('Source: live Google Sheets NC register (via DataSource)');
      return ncRecords.values;
    }
  }

  return loadNcValuesFromSheets();
}

async function main() {
  const { parseConfig } = await resolveParseConfig();
  const ncValues = await loadNcValues();
  const parsed = parseNcCopqRecords(ncValues, parseConfig);
  const rows = parsed.records.map((record) => ({
    sourceKey: record.sourceKey,
    ncNumber: record.ncNumber,
    displayDate: record.displayDate,
    product: record.product,
    department: record.department,
    rootCause: record.rootCause,
    category: record.category,
    status: record.status,
  }));

  console.log(`\nParsed ${rows.length} NC records (rejected: ${parsed.rejectedRowCount})`);
  console.log(`Columns used: date=${parsed.dateColumnUsed}, copq=${parsed.copqColumnUsed}\n`);

  const fields: FieldKey[] = [
    'sourceKey',
    'ncNumber',
    'displayDate',
    'product',
    'department',
    'rootCause',
    'category',
    'status',
  ];

  const results = fields.map((field) => analyzeField(rows, field));

  console.log('Field analysis (character lengths, UTF-8 safe via spread):\n');
  console.table(results.map((row) => ({
    field: row.field,
    currentLimit: row.currentLimit,
    maxLength: row.maxLength,
    exceeds: row.exceedsCurrent ? 'YES' : 'no',
    recommended: (() => {
      const limit = recommendFieldLimit(row.maxLength);
      return typeof limit === 'number' ? `VARCHAR(${limit})` : 'TEXT';
    })(),
  })));

  const offenders = results.filter((row) => row.exceedsCurrent);
  if (offenders.length > 0) {
    console.log('\nFields exceeding current schema:\n');
    for (const row of offenders) {
      console.log(`--- ${row.field} (max ${row.maxLength} > limit ${row.currentLimit}) ---`);
      console.log(row.longestValue);
      console.log('');
    }
  }

  console.log('\nJSON report:');
  console.log(JSON.stringify({
    recordCount: rows.length,
    rejectedRowCount: parsed.rejectedRowCount,
    fields: results.map((row) => ({
      field: row.field,
      currentLimit: row.currentLimit,
      maxLength: row.maxLength,
      exceedsCurrent: row.exceedsCurrent,
      recommended: recommendFieldLimit(row.maxLength),
      longestValuePreview: row.longestValue.slice(0, 200),
    })),
  }, null, 2));

  await closePool().catch(() => undefined);
}

main().catch(async (error) => {
  console.error('[analyze-copq-field-lengths] Failed', error);
  await closePool().catch(() => undefined);
  process.exitCode = 1;
});
