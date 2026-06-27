import { describe, expect, it } from 'vitest';
import { isO34SourceCell, isT13SourceCell, resolveCopqHeadlineValue } from '../src/copq/copqKpiValue.js';
describe('resolveCopqHeadlineValue', () => {
    it('uses O34 metadata when available', () => {
        expect(resolveCopqHeadlineValue({
            valueDecimal: '321762.5899',
            metadata: { sourceCell: 'O34', copqYtd: '321762.5899' },
        })).toBe(321762.5899);
    });
    it('rejects T13 staged copqValue and valueDecimal', () => {
        expect(resolveCopqHeadlineValue({
            valueDecimal: '620461.4592',
            metadata: { sourceCell: 'T13', copqValue: '620461.4592', copqBeforeQaClearance: '620461.4592' },
        })).toBeNull();
    });
    it('prefers copqYtd metadata over valueDecimal for O34 snapshots', () => {
        expect(resolveCopqHeadlineValue({
            valueDecimal: '620461.4592',
            metadata: { sourceCell: 'O34', copqYtd: '321762.5899', totalCopq: '321762.5899' },
        })).toBe(321762.5899);
    });
    it('returns null when source cell is not O34', () => {
        expect(resolveCopqHeadlineValue({
            valueDecimal: '620461.4592',
            metadata: { sourceCell: 'T13' },
        })).toBeNull();
    });
});
describe('isO34SourceCell', () => {
    it('recognizes O34 references', () => {
        expect(isO34SourceCell('O34')).toBe(true);
        expect(isO34SourceCell('Dashboard!O34')).toBe(true);
        expect(isO34SourceCell('T13')).toBe(false);
    });
});
describe('isT13SourceCell', () => {
    it('recognizes T13 references', () => {
        expect(isT13SourceCell('T13')).toBe(true);
        expect(isT13SourceCell('Dashboard!T13')).toBe(true);
        expect(isT13SourceCell('O34')).toBe(false);
    });
});
