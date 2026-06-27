import { Decimal } from 'decimal.js';

export function toDecimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
    const decimal = new Decimal(normalized as Decimal.Value);
    return decimal.isFinite() ? decimal : null;
  } catch {
    return null;
  }
}

export function sumDecimals(values: Array<Decimal | null>): Decimal {
  return values.reduce<Decimal>((total, value) => (value ? total.plus(value) : total), new Decimal(0));
}
