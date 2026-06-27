import { describe, expect, it } from 'vitest';
import { formatChangePercent, formatChartDateLabel, formatDate, formatDateTime, formatKpiValue, formatRelativeDateTime, formatSnapshotLabel } from './formatters';

describe('formatters', () => {
  it('formats currency KPI values', () => {
    expect(formatKpiValue('1250000', 'currency')).toBe('₹12.50 L');
    expect(formatKpiValue('62695748', 'currency')).toBe('₹6.27 Cr');
  });

  it('formats unavailable values', () => {
    expect(formatKpiValue(null, 'currency')).toBe('Unavailable');
  });

  it('formats positive comparison values', () => {
    expect(formatChangePercent('12.5')).toBe('+12.50% vs previous');
  });

  it('formats snapshot keys readably', () => {
    expect(formatSnapshotLabel('20260618_071755')).toMatch(/18 Jun 2026/i);
    expect(formatSnapshotLabel('20260618_071755')).toMatch(/7:17/i);
  });

  it('formats iso dates readably', () => {
    expect(formatDate('2026-06-18')).toBe('18 Jun 2026');
    expect(formatDateTime('2026-06-18T07:19:42.000Z')).toMatch(/18 Jun 2026/i);
  });

  it('formats loose dmy dates', () => {
    expect(formatDate('15-06-2026 00:00:00')).toBe('15 Jun 2026');
  });

  it('formats chart labels compactly', () => {
    expect(formatChartDateLabel('2026-06-18')).toMatch(/18 Jun/);
  });

  it('formats relative sync times', () => {
    const recent = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatRelativeDateTime(recent)).toBe('5 min ago');
  });
});
