import { describe, expect, it } from 'vitest';
import {
  countDigitsBeforeCursor,
  cursorAfterFormattedDigit,
  formatIndianIntegerDigits,
  mergeDigitsAtSelection,
  parseIndianIntegerInput,
  sanitizeIntegerDigits,
} from './currencyInput';

describe('currencyInput integer helpers', () => {
  it('sanitizes to digits only', () => {
    expect(sanitizeIntegerDigits('₹12,50,000.50 abc')).toBe('125000050');
    expect(sanitizeIntegerDigits('')).toBe('');
  });

  it('formats with Indian grouping', () => {
    expect(formatIndianIntegerDigits('1000000')).toBe('10,00,000');
    expect(formatIndianIntegerDigits('1250000')).toBe('12,50,000');
    expect(formatIndianIntegerDigits('')).toBe('');
  });

  it('parses formatted values to plain numbers', () => {
    expect(parseIndianIntegerInput('10,00,000')).toBe(1000000);
    expect(parseIndianIntegerInput('₹12,50,000')).toBe(1250000);
    expect(parseIndianIntegerInput('')).toBeNull();
  });

  it('maps cursor positions across formatting', () => {
    const formatted = '10,00,000';
    expect(countDigitsBeforeCursor(formatted, 0)).toBe(0);
    expect(countDigitsBeforeCursor(formatted, 3)).toBe(2);
    expect(countDigitsBeforeCursor(formatted, 4)).toBe(3);
    expect(countDigitsBeforeCursor(formatted, 5)).toBe(4);
    expect(cursorAfterFormattedDigit(formatted, 2)).toBe(2);
    expect(cursorAfterFormattedDigit(formatted, 3)).toBe(4);
  });

  it('merges pasted digits at selection', () => {
    const display = '12,50,000';
    const current = sanitizeIntegerDigits(display);
    const merged = mergeDigitsAtSelection(current, 0, 0, display, '99');
    expect(merged.digits).toBe('991250000');
    expect(merged.cursorDigitIndex).toBe(2);
  });
});
