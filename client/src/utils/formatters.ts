const IST_TIMEZONE = 'Asia/Kolkata';

const IST_OFFSET = '+05:30';

function parseSnapshotKey(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})?/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss = '00'] = match;
  const parsed = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss.padEnd(2, '0')}${IST_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseLooseDate(value: string): Date | null {
  const dmyTime = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/.exec(value.trim());
  if (dmyTime) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = dmyTime;
    const parsed = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}${IST_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (isoDateOnly) {
    const [, y, m, d] = isoDateOnly;
    const parsed = new Date(`${y}-${m}-${d}T00:00:00${IST_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseDateInput(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return parseSnapshotKey(trimmed) ?? parseLooseDate(trimmed);
}

export function formatDate(value: string | Date | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TIMEZONE,
  }).format(parsed);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return 'Not updated yet';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TIMEZONE,
  }).format(parsed);
}

export function formatTime(value: string | Date | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST_TIMEZONE,
  }).format(parsed);
}

function dateKeyInIst(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: IST_TIMEZONE,
  }).format(value);
}

export function formatSyncSessionTime(value: string | Date | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return '—';

  const now = new Date();
  const time = formatTime(parsed);
  const parsedKey = dateKeyInIst(parsed);
  const todayKey = dateKeyInIst(now);

  if (parsedKey === todayKey) return `Today • ${time}`;

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (parsedKey === dateKeyInIst(yesterday)) return `Yesterday • ${time}`;

  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year:
      new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: IST_TIMEZONE }).format(parsed)
      !== new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: IST_TIMEZONE }).format(now)
        ? 'numeric'
        : undefined,
    timeZone: IST_TIMEZONE,
  }).format(parsed);

  return `${dateLabel} • ${time}`;
}

export function formatSyncTypeLabel(syncType: 'MANUAL' | 'AUTOMATIC'): string {
  return syncType === 'MANUAL' ? 'Manual Sync' : 'Automatic Sync';
}

export function formatSnapshotLabel(snapshotKey: string): string {
  const parsed = parseSnapshotKey(snapshotKey);
  if (!parsed) return snapshotKey;
  return formatDateTime(parsed);
}

export function formatChartDateLabel(value: string | Date | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return '—';

  const now = new Date();
  const sameYear = parsed.getUTCFullYear() === now.getUTCFullYear();

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' }),
    timeZone: IST_TIMEZONE,
  }).format(parsed);
}

export function formatRelativeDateTime(value: string | Date | null | undefined): string {
  const parsed = parseDateInput(value);
  if (!parsed) return 'Not updated yet';

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return formatDateTime(parsed);
}

export function formatKpiValue(value: string | null, displayFormat: string): string {
  if (value === null) return 'Unavailable';

  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return value;

  switch (displayFormat) {
    case 'currency':
      if (Math.abs(numericValue) >= 10000000) return `₹${(numericValue / 10000000).toFixed(2)} Cr`;
      if (Math.abs(numericValue) >= 100000) return `₹${(numericValue / 100000).toFixed(2)} L`;
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(numericValue);
    case 'percentage':
      return `${numericValue.toFixed(2)}%`;
    case 'ratio':
      return `${numericValue.toFixed(2)}x`;
    default:
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(numericValue);
  }
}

export function formatChangePercent(value: string | null): string {
  if (value === null) return 'No comparison';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return 'No comparison';
  const prefix = numericValue > 0 ? '+' : '';
  return `${prefix}${numericValue.toFixed(2)}% vs previous`;
}
