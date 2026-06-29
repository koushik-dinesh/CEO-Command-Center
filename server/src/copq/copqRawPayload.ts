export interface CopqNcRecordsPayload {
  sheetName?: string;
  range?: string;
  values?: unknown[][];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function extractNcRecordsFromCopqRaw(raw: unknown): CopqNcRecordsPayload | null {
  const record = asRecord(raw);
  const ncRecords = record.ncRecords;
  if (!ncRecords || typeof ncRecords !== 'object') return null;

  const payload = ncRecords as CopqNcRecordsPayload;
  if (!Array.isArray(payload.values) || payload.values.length === 0) return null;

  return payload;
}

/** Remove the multi-MB NC register blob before persisting COPQ staging raw. */
export function stripNcRecordsFromCopqRaw(raw: unknown): unknown {
  const record = asRecord(raw);
  if (!('ncRecords' in record)) return raw;

  const { ncRecords: _removed, ...rest } = record;
  return rest;
}
