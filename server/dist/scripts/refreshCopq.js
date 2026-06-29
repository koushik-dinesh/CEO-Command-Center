import 'dotenv/config';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '../.env') });
import { transaction } from '../src/db/mysql.js';
import { ProcessingStatus } from '../src/db/types.js';
import { GoogleSheetsService } from '../src/ingestion/googleSheetsService.js';
import { sheetValuesToRows } from '../src/ingestion/csvParser.js';
import { normalizeRows } from '../src/ingestion/sourceAdapters.js';
import { KpiCalculationService } from '../src/kpis/KpiCalculationService.js';
import { CopqAnalyticsService } from '../src/copq/CopqAnalyticsService.js';
import { loadCopqDataSourceContext } from '../src/copq/copqNcParseConfig.js';
import { extractNcRecordsFromCopqRaw } from '../src/copq/copqRawPayload.js';
import { DataSourceRepository } from '../src/repositories/DataSourceRepository.js';
import { StagingRecordRepository } from '../src/repositories/StagingRecordRepository.js';
import { UploadedFileRepository } from '../src/repositories/UploadedFileRepository.js';
import { createHash } from 'node:crypto';
import { closePool } from '../src/db/mysql.js';
function checksum(content) {
    return createHash('sha256').update(content).digest('hex');
}
async function main() {
    const sources = await DataSourceRepository.activeSources();
    const source = sources.find((candidate) => candidate.code === 'COPQ_DASHBOARD_SHEET');
    if (!source)
        throw new Error('COPQ_DASHBOARD_SHEET not found');
    const sheets = new GoogleSheetsService();
    const payload = await sheets.fetchRange(source);
    const rows = sheetValuesToRows(payload.content);
    const normalized = normalizeRows(source, rows, {
        sourceDate: payload.modifiedTime ?? new Date(),
        sourceFileName: payload.fileName,
    });
    if (normalized.accepted.length === 0) {
        console.error('COPQ normalization rejected all rows:', normalized.rejected);
        process.exit(1);
    }
    const extracted = normalized.accepted[0].normalized;
    console.log('\n=== LIVE SHEET EXTRACTION ===');
    console.log(JSON.stringify({
        O34_totalCopq: extracted.totalCopq,
        T13_beforeQaClearance: extracted.copqBeforeQaClearance,
        T5_qaSaved: extracted.qaSavedAmount,
        sourceCell: extracted.sourceCell,
        copqMtd: extracted.copqMtd,
        copqQtd: extracted.copqQtd,
        copqMtdRowCount: extracted.copqMtdRowCount,
        copqQtdRowCount: extracted.copqQtdRowCount,
        mtdSourceKeys: extracted.copqMtdSourceKeys,
        qtdSourceKeys: extracted.copqQtdSourceKeys,
        ncDateColumnUsed: extracted.ncDateColumnUsed,
        ncCopqColumnUsed: extracted.ncCopqColumnUsed,
    }, null, 2));
    await transaction(async (connection) => {
        const contentChecksum = checksum(payload.content);
        const providerFileVersionId = `${payload.providerFileId}:refresh:${Date.now()}`;
        const uploadedFile = await UploadedFileRepository.create({
            dataSourceId: source.id,
            providerFileId: providerFileVersionId,
            fileName: payload.fileName,
            mimeType: payload.mimeType ?? null,
            checksum: contentChecksum,
            modifiedTime: payload.modifiedTime ?? null,
            sizeBytes: payload.sizeBytes ?? null,
            status: ProcessingStatus.SUCCESS,
        }, connection);
        const copqContext = await loadCopqDataSourceContext();
        if (copqContext) {
            for (const record of normalized.accepted) {
                const ncRecords = extractNcRecordsFromCopqRaw(record.raw);
                if (!ncRecords?.values?.length)
                    continue;
                const result = await CopqAnalyticsService.persistFromNcValues({
                    dataSourceId: copqContext.dataSourceId,
                    ncValues: ncRecords.values,
                    ncSheetName: ncRecords.sheetName,
                    normalized: record.normalized,
                    parseConfig: copqContext.parseConfig,
                    config: copqContext.config,
                }, connection);
                console.log('\nNC facts persisted:', result);
            }
        }
        await StagingRecordRepository.upsertMany(normalized.accepted.map((record) => ({
            dataSourceId: source.id,
            sourceDate: record.sourceDate,
            sourceKey: record.sourceKey,
            normalized: record.normalized,
            raw: {},
        })), connection);
        console.log('\nStaging record created:', uploadedFile.id);
    });
    const persisted = await new KpiCalculationService().calculateAndPersist();
    const copq = persisted.find((row) => row.metadataJson && row.metadataJson.sourceCell);
    console.log('\n=== KPI VALUE PERSISTED ===');
    console.log(JSON.stringify({
        valueDecimal: copq?.valueDecimal,
        previousValueDecimal: copq?.previousValueDecimal,
        sourceCell: copq?.metadataJson?.sourceCell,
        copqYtd: copq?.metadataJson?.copqYtd,
        copqMtd: copq?.metadataJson?.copqMtd,
        copqQtd: copq?.metadataJson?.copqQtd,
    }, null, 2));
}
main()
    .then(async () => closePool())
    .catch(async (error) => {
    console.error(error);
    await closePool();
    process.exit(1);
});
