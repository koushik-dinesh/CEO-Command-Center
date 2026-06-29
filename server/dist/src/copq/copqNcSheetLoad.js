import { sheetValuesToRows } from '../ingestion/csvParser.js';
import { GoogleSheetsService } from '../ingestion/googleSheetsService.js';
import { DataSourceRepository } from '../repositories/DataSourceRepository.js';
import { extractNcRecordsFromCopqRaw } from './copqRawPayload.js';
export async function resolveCopqNcValues(raw) {
    const fromStaging = extractNcRecordsFromCopqRaw(raw);
    if (fromStaging?.values?.length) {
        return { values: fromStaging.values, sheetName: fromStaging.sheetName, source: 'staging' };
    }
    const sources = await DataSourceRepository.activeSources();
    const source = sources.find((candidate) => candidate.code === 'COPQ_DASHBOARD_SHEET');
    if (!source)
        throw new Error('COPQ_DASHBOARD_SHEET not found');
    const payload = await new GoogleSheetsService().fetchRange(source);
    const rows = sheetValuesToRows(payload.content);
    const row = rows[0];
    const fromSheet = extractNcRecordsFromCopqRaw(row);
    if (!fromSheet?.values?.length) {
        throw new Error('No NC register rows available in staging or live Google Sheet');
    }
    return { values: fromSheet.values, sheetName: fromSheet.sheetName, source: 'live-sheet' };
}
