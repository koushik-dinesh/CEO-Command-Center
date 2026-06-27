import { describe, expect, it } from 'vitest';
import { formatCompactCurrency, formatExactCurrency, formatExactPercent, formatPercent } from './command-center';

describe('command-center precision formatters', () => {
  it('formats compact currency for executive display', () => {
    expect(formatCompactCurrency(3_49_87_432.18)).toBe('₹3.50Cr');
    expect(formatCompactCurrency(32_19_845.73)).toBe('₹32.20L');
  });

  it('formats exact currency for tooltips', () => {
    expect(formatExactCurrency(3_49_87_432.18)).toBe('₹3,49,87,432.18');
    expect(formatExactCurrency(32_19_845.73)).toBe('₹32,19,845.73');
  });

  it('formats compact and exact percentages', () => {
    expect(formatPercent(56.03, 1)).toBe('56.0%');
    expect(formatExactPercent(56.03)).toBe('56.03%');
  });
});
