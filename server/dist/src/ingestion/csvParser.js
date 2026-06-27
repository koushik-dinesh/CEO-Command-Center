import { parse } from 'csv-parse/sync';
import { logO34Stage } from '../copq/o34PipelineTrace.js';
export function parseCsv(content) {
    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });
}
export function sheetValuesToRows(content) {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.type === 'copqDashboard') {
        const dashboard = parsed;
        logO34Stage('RAW INGESTION PAYLOAD O34', dashboard.cells?.totalCopq ?? null, dashboard.cells ?? null);
        logO34Stage('RAW INGESTION PAYLOAD', dashboard, dashboard);
        return [dashboard];
    }
    if (!Array.isArray(parsed) || parsed.length === 0)
        return [];
    const [headers, ...rows] = parsed;
    return rows.map((row) => Object.fromEntries(headers.map((header, index) => [String(header), row[index] ?? ''])));
}
