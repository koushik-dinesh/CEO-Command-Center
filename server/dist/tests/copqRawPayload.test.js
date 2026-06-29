import { describe, expect, it } from 'vitest';
import { extractNcRecordsFromCopqRaw, stripNcRecordsFromCopqRaw } from '../src/copq/copqRawPayload.js';
describe('copqRawPayload', () => {
    it('extracts ncRecords from COPQ ingestion raw', () => {
        const raw = {
            type: 'copqDashboard',
            cells: { totalCopq: { ref: 'O34', effectiveValue: 100 } },
            ncRecords: {
                sheetName: 'Form Responses 1',
                values: [['NC DATE', 'FINAL COPQ'], ['2026-04-10', 100]],
            },
        };
        const extracted = extractNcRecordsFromCopqRaw(raw);
        expect(extracted?.sheetName).toBe('Form Responses 1');
        expect(extracted?.values).toHaveLength(2);
    });
    it('strips ncRecords while preserving dashboard cells for staging', () => {
        const raw = {
            type: 'copqDashboard',
            cells: { totalCopq: { ref: 'O34', effectiveValue: 100 } },
            ncRecords: {
                sheetName: 'Form Responses 1',
                values: [['NC DATE', 'FINAL COPQ'], ['2026-04-10', 100]],
            },
        };
        const stripped = stripNcRecordsFromCopqRaw(raw);
        expect(stripped.ncRecords).toBeUndefined();
        expect(stripped.cells).toEqual(raw.cells);
        expect(stripped.type).toBe('copqDashboard');
    });
});
