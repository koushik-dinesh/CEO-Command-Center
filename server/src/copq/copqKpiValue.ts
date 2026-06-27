/** Resolves the COPQ headline / YTD from Dashboard!O34 (TOTAL COPQ) only. */
import { logO34Stage } from './o34PipelineTrace.js';

export function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

export function metadataDecimal(metadata: unknown, key: string): number | null {
  const raw = metadataString(metadata, key);
  if (raw == null || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isO34SourceCell(sourceCell: string | null | undefined): boolean {
  if (!sourceCell) return false;
  return sourceCell.toUpperCase() === 'O34' || sourceCell.toUpperCase().endsWith('!O34');
}

export function isT13SourceCell(sourceCell: string | null | undefined): boolean {
  if (!sourceCell) return false;
  return sourceCell.toUpperCase() === 'T13' || sourceCell.toUpperCase().endsWith('!T13');
}

export function resolveCopqHeadlineValue(input: {
  valueDecimal: string | null | undefined;
  metadata: unknown;
}): number | null {
  const sourceCell = metadataString(input.metadata, 'sourceCell');
  const totalCopq = metadataDecimal(input.metadata, 'copqYtd') ?? metadataDecimal(input.metadata, 'totalCopq');
  const stored = input.valueDecimal != null ? Number(input.valueDecimal) : null;
  const storedValue = stored != null && Number.isFinite(stored) ? stored : null;

  if (isT13SourceCell(sourceCell)) {
    logO34Stage('RESOLVE O34 HEADLINE', {
      rejected: true,
      reason: 'sourceCell is T13',
      sourceCell,
      totalCopq,
      valueDecimal: storedValue,
    }, input.metadata as Record<string, unknown>);
    return null;
  }
  if (!isO34SourceCell(sourceCell)) {
    logO34Stage('RESOLVE O34 HEADLINE', {
      rejected: true,
      reason: 'sourceCell is not O34',
      sourceCell,
      totalCopq,
      valueDecimal: storedValue,
    }, input.metadata as Record<string, unknown>);
    return null;
  }

  const resolved = totalCopq ?? storedValue;
  logO34Stage('RESOLVE O34 HEADLINE', {
    rejected: false,
    sourceCell,
    totalCopq,
    valueDecimal: storedValue,
    resolved,
  }, input.metadata as Record<string, unknown>);
  return resolved;
}

export function isO34KpiSnapshot(metadata: unknown): boolean {
  return isO34SourceCell(metadataString(metadata, 'sourceCell'));
}

export interface CopqKpiHistoryPoint {
  calculatedAt: Date;
  valueDecimal: string | null;
  metadataJson: unknown;
}

export function filterO34CopqHistory<T extends CopqKpiHistoryPoint>(rows: T[]): T[] {
  return rows.filter((row) => isO34KpiSnapshot(row.metadataJson));
}
