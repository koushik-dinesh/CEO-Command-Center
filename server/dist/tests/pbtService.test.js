import { describe, expect, it } from 'vitest';
import { calculatePbt, computeTotalIndirectExpense, validateExpenseValue, validateMonthYear, } from '../src/pbt/PbtService.js';
describe('PBT calculation', () => {
    it('calculates PBT as revenue minus direct and total indirect expenses', () => {
        expect(calculatePbt(1_000_000, 300_000, 200_000)).toBe(500_000);
    });
    it('combines HR and additional indirect into total indirect expense', () => {
        expect(computeTotalIndirectExpense(125_000, 75_000)).toBe(200_000);
        expect(computeTotalIndirectExpense(null, 50_000)).toBe(50_000);
        expect(computeTotalIndirectExpense(125_000, null)).toBe(125_000);
    });
    it('returns null when revenue is missing', () => {
        expect(calculatePbt(null, 100, 100)).toBeNull();
    });
    it('returns null when an expense is missing', () => {
        expect(calculatePbt(1_000, null, 100)).toBeNull();
        expect(calculatePbt(1_000, 100, null)).toBeNull();
    });
});
describe('PBT validation', () => {
    it('rejects negative expense values', () => {
        expect(() => validateExpenseValue(-1, 'Direct expense')).toThrow(/cannot be negative/);
    });
    it('rejects non-numeric expense values', () => {
        expect(() => validateExpenseValue('abc', 'Indirect expense')).toThrow(/valid number/);
    });
    it('accepts valid non-negative numbers', () => {
        expect(validateExpenseValue(0, 'Direct expense')).toBe(0);
        expect(validateExpenseValue('12500.50', 'Indirect expense')).toBe(12500.5);
    });
    it('accepts zero additional indirect expense', () => {
        expect(validateExpenseValue(0, 'Additional indirect expense')).toBe(0);
    });
    it('validates month and year ranges', () => {
        expect(validateMonthYear(6, 2026)).toEqual({ month: 6, year: 2026 });
        expect(() => validateMonthYear(13, 2026)).toThrow(/Month/);
        expect(() => validateMonthYear(1, 1999)).toThrow(/Year/);
    });
});
