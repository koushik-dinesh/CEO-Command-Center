import { parse } from 'csv-parse/sync';
import { Decimal } from 'decimal.js';

export function parseCsvRows(content: string): Record<string, string>[] {
  if (!content.trim()) return [];
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, trim: true }) as Record<string, string>[];
}

export function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return new Decimal(part).div(total).mul(100).toDecimalPlaces(2).toNumber();
}
