import { Decimal } from 'decimal.js';
export function toDecimal(value) {
    if (value === null || value === undefined || value === '')
        return null;
    try {
        const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value;
        const decimal = new Decimal(normalized);
        return decimal.isFinite() ? decimal : null;
    }
    catch {
        return null;
    }
}
export function sumDecimals(values) {
    return values.reduce((total, value) => (value ? total.plus(value) : total), new Decimal(0));
}
