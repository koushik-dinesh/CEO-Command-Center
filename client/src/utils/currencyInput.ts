/** Strip to digits only (0–9). */
export function sanitizeIntegerDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Format a digit-only string with Indian grouping (no decimals). */
export function formatIndianIntegerDigits(digits: string): string {
  if (digits === '') return '';
  // Avoid Number overflow display issues for very long strings; BigInt not needed for HR expense.
  const num = Number(digits);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/** Parse formatted or raw input to integer, or null when empty. */
export function parseIndianIntegerInput(value: string): number | null {
  const digits = sanitizeIntegerDigits(value);
  if (digits === '') return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Count digit characters strictly before cursor index in a display string. */
export function countDigitsBeforeCursor(display: string, cursor: number): number {
  return sanitizeIntegerDigits(display.slice(0, cursor)).length;
}

/** Map digit index (0 = before first digit) to cursor position in formatted display. */
export function cursorAfterFormattedDigit(formatted: string, digitIndex: number): number {
  if (digitIndex <= 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i]!)) {
      count += 1;
      if (count === digitIndex) return i + 1;
    }
  }
  return formatted.length;
}

export function mergeDigitsAtSelection(
  currentDigits: string,
  selectionStart: number,
  selectionEnd: number,
  display: string,
  insertDigits: string,
): { digits: string; cursorDigitIndex: number } {
  const before = countDigitsBeforeCursor(display, selectionStart);
  const after = countDigitsBeforeCursor(display, selectionEnd);
  const digits = `${currentDigits.slice(0, before)}${insertDigits}${currentDigits.slice(after)}`;
  return { digits, cursorDigitIndex: before + insertDigits.length };
}

export function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[₹,\s]/g, '');
  if (cleaned === '') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrencyInput(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function formatCurrencyDisplay(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
