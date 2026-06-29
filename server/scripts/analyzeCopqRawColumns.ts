import 'dotenv/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '../.env') });

import { google } from 'googleapis';
import { createGoogleAuth } from '../src/ingestion/googleAuth.js';

const SPREADSHEET_ID = '1V28mVxJtrqlzvaUTZAogAiI1PjKF4SjdJIGZotaC5vk';
const RANGE = "'Form Responses 1'!A:BC";

const COLUMN_CANDIDATES = {
  ncNumber: ['QC NC number', 'NC Number', 'NC NO', 'NC No'],
  product: ['Product name', 'Product Name'],
  department: ['QC Location'],
  rootCausePrimary: ['Reason For Rejection'],
  rootCauseFallback: ['Complaint name'],
  category: ['Issue Related to'],
  qcType: ['QC'],
  status: ['Status'],
};

function norm(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function findIdx(headers: string[], candidates: string[]): number {
  const lower = headers.map((header) => norm(header).toLowerCase());
  for (const candidate of candidates) {
    const index = lower.indexOf(norm(candidate).toLowerCase());
    if (index >= 0) return index;
  }
  return -1;
}

function maxLen(values: unknown[]) {
  let max = 0;
  let longest = '';
  for (const value of values) {
    const text = String(value ?? '');
    const len = [...text].length;
    if (len > max) {
      max = len;
      longest = text;
    }
  }
  return { max, longest };
}

async function main() {
  const sheets = google.sheets({ version: 'v4', auth: createGoogleAuth() });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const values = response.data.values ?? [];
  let headerIdx = 0;
  for (let index = 0; index < Math.min(5, values.length); index += 1) {
    const joined = (values[index] ?? []).map((cell) => norm(cell).toLowerCase()).join(' ');
    if (joined.includes('final copq') || joined.includes('copq')) {
      headerIdx = index;
      break;
    }
  }

  const headers = (values[headerIdx] ?? []).map(norm);
  const dataRows = values.slice(headerIdx + 1);
  const indices = Object.fromEntries(
    Object.entries(COLUMN_CANDIDATES).map(([key, candidates]) => [key, findIdx(headers, candidates)]),
  );

  console.log(`Header row: ${headerIdx}, data rows: ${dataRows.length}`);
  console.log('Column indices:', indices);

  const report: Array<{ field: string; header: string | null; maxLength: number; longestPreview: string }> = [];
  for (const [key, index] of Object.entries(indices)) {
    if (index < 0) {
      report.push({ field: key, header: null, maxLength: 0, longestPreview: '' });
      continue;
    }
    const column = dataRows.map((row) => (Array.isArray(row) ? row[index] : ''));
    const { max, longest } = maxLen(column);
    report.push({
      field: key,
      header: headers[index] ?? null,
      maxLength: max,
      longestPreview: longest.slice(0, 300),
    });
  }

  const rootCauseCombined = dataRows.map((row) => {
    const primary = indices.rootCausePrimary >= 0 ? norm((row as unknown[])[indices.rootCausePrimary]) : '';
    const fallback = indices.rootCauseFallback >= 0 ? norm((row as unknown[])[indices.rootCauseFallback]) : '';
    return primary || fallback;
  });
  const combined = maxLen(rootCauseCombined);
  report.push({
    field: 'rootCauseCombined',
    header: 'Reason For Rejection || Complaint name',
    maxLength: combined.max,
    longestPreview: combined.longest.slice(0, 300),
  });

  console.log('\nRaw column analysis:\n');
  console.table(report);
  console.log('\nJSON:', JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
