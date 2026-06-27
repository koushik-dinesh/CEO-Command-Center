export function formatCompactDays(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(0)}d`;
}

export function formatExactDays(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(1)} Days`;
}

export function formatCompactRatio(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)}×`;
}

export function formatExactRatio(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)}×`;
}

export function formatCompactCurrency(value: number | null): string {
  if (value === null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `₹${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `₹${(value / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1)}K`;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatExactCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function formatPercent(value: number | null, digits = 1): string {
  if (value === null) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatExactPercent(value: number | null, digits = 2): string {
  if (value === null) return '—';
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercentDisplay(value: number, digits = 1): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatSignedPercentExact(value: number, digits = 2): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}%`;
}

export function trendArrow(trend: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN'): string {
  if (trend === 'UP') return '▲';
  if (trend === 'DOWN') return '▼';
  if (trend === 'FLAT') return '→';
  return '•';
}

export function sparklineDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min * 0.95, max * 1.05 || 1];
  const pad = (max - min) * 0.15;
  return [min - pad, max + pad];
}
