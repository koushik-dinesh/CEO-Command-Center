import { parse } from 'csv-parse/sync';
import type { RawRow } from './types.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';

export function parseCsv(content: string): RawRow[] {
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as RawRow[];
}

export function sheetValuesToRows(content: string): RawRow[] {
  const parsed = JSON.parse(content) as unknown;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as { type?: string }).type === 'copqDashboard') {
    const dashboard = parsed as RawRow & { cells?: Record<string, unknown> };
    logO34Stage('RAW INGESTION PAYLOAD O34', (dashboard.cells as Record<string, unknown> | undefined)?.totalCopq ?? null, dashboard.cells as Record<string, unknown> | undefined ?? null);
    logO34Stage('RAW INGESTION PAYLOAD', dashboard, dashboard as unknown as Record<string, unknown>);
    return [dashboard];
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  const [headers, ...rows] = parsed as unknown[][];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [String(header), row[index] ?? ''])));
}
