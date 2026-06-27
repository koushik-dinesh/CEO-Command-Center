import { parseSnapshotFilename } from '../reports/filename-parser.js';
import type { ReportSnapshotRow } from '../repositories/ReportSnapshotRepository.js';
import type { ReportType } from '../reports/types.js';

function isValidYmd(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() + 1 === month
    && parsed.getUTCDate() === day;
}

/** Normalize any snapshot date input to YYYY-MM-DD. */
export function normalizeSnapshotDate(value: unknown): string | null {
  if (value == null) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    const normalized = `${y}-${m}-${d}`;
    return isValidYmd(normalized) ? normalized : null;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return isValidYmd(trimmed) ? trimmed : null;
  }

  const isoPrefix = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (isoPrefix?.[1] && isValidYmd(isoPrefix[1])) return isoPrefix[1];

  if (/^\d{8}$/.test(trimmed)) {
    const normalized = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
    return isValidYmd(normalized) ? normalized : null;
  }

  const fromFilename = parseDateFromFilename(trimmed);
  if (fromFilename) return fromFilename;

  const fromKey = parseDateFromSnapshotKey(trimmed);
  if (fromKey) return fromKey;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return normalizeSnapshotDate(parsed);
  }

  return null;
}

export function parseDateFromFilename(fileName: string): string | null {
  if (!fileName) return null;
  const parsed = parseSnapshotFilename(fileName);
  return parsed?.snapshotDate ?? null;
}

export function parseDateFromSnapshotKey(snapshotKey: string): string | null {
  if (!snapshotKey) return null;
  const match = /^(\d{4})(\d{2})(\d{2})_/.exec(snapshotKey.trim());
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  return isValidYmd(normalized) ? normalized : null;
}

export interface SnapshotDateResolution {
  snapshotDate: string | null;
  source: string | null;
  rawValue: unknown;
}

type SnapshotDateSource = {
  reportType: ReportType;
  snapshotDate: unknown;
  snapshotKey: string;
  fileName: string;
};

function candidateSources(
  batch: SnapshotDateSource[],
  preferredReportType?: ReportType,
): Array<{ label: string; value: unknown }> {
  const preferred = preferredReportType
    ? batch.find((row) => row.reportType === preferredReportType)
    : undefined;

  const orderedRows = preferred
    ? [preferred, ...batch.filter((row) => row.reportType !== preferredReportType)]
    : batch;

  const candidates: Array<{ label: string; value: unknown }> = [];

  for (const row of orderedRows) {
    candidates.push(
      { label: `${row.reportType}.snapshotDate`, value: row.snapshotDate },
      { label: `${row.reportType}.fileName`, value: row.fileName },
      { label: `${row.reportType}.snapshotKey`, value: row.snapshotKey },
    );
  }

  return candidates;
}

export function resolveSnapshotDateFromBatch(
  batch: SnapshotDateSource[],
  options?: {
    preferredReportType?: ReportType;
    fallback?: unknown;
    debugLabel?: string;
  },
): SnapshotDateResolution {
  const candidates = candidateSources(batch, options?.preferredReportType);
  if (options?.fallback !== undefined) {
    candidates.push({ label: 'fallback', value: options.fallback });
  }

  for (const candidate of candidates) {
    const normalized = normalizeSnapshotDate(candidate.value);
    if (normalized) {
      if (process.env.NODE_ENV !== 'production' && options?.debugLabel) {
        console.log(`[snapshot-date:${options.debugLabel}] resolved`, {
          source: candidate.label,
          rawSnapshotDate: candidate.value,
          parsedSnapshotDate: normalized,
        });
      }
      return {
        snapshotDate: normalized,
        source: candidate.label,
        rawValue: candidate.value,
      };
    }
  }

  if (process.env.NODE_ENV !== 'production' && options?.debugLabel) {
    console.warn(`[snapshot-date:${options.debugLabel}] unable to resolve snapshot date`, {
      batch: batch.map((row) => ({
        reportType: row.reportType,
        snapshotDate: row.snapshotDate,
        snapshotKey: row.snapshotKey,
        fileName: row.fileName,
      })),
      fallback: options?.fallback ?? null,
    });
  }

  return { snapshotDate: null, source: null, rawValue: null };
}

export function formatSnapshotDateFromDb(value: unknown): string {
  return normalizeSnapshotDate(value) ?? '';
}
