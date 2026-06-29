import { calculateCopqPeriodTotals } from './copqPeriods.js';
import { loadCopqDataSourceContext } from './copqNcParseConfig.js';
import { parseNcCopqRecords } from './ncRecords.js';
import { extractCopqHeadline } from './copqHeadline.js';
import { CopqAnalyticsMetaRepository } from '../repositories/CopqAnalyticsMetaRepository.js';
import { NcCopqFactRepository } from '../repositories/NcCopqFactRepository.js';
import { financialYearStartDate } from '../command-center/inventoryDays.js';
import { calendarMonthStart, financialQuarterStartDate } from './copqPeriods.js';
import { logger } from '../utils/logger.js';
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
function metadataString(metadata, key) {
    if (!metadata || typeof metadata !== 'object')
        return null;
    const value = metadata[key];
    return typeof value === 'string' && value ? value : null;
}
export class CopqAnalyticsService {
    static async persistFromNcValues(input, executor) {
        if (!input.ncValues.length)
            return null;
        const normalized = asRecord(input.normalized);
        const parsed = parseNcCopqRecords(input.ncValues, input.parseConfig);
        const referenceDate = metadataString(normalized, 'copqReferenceDate')
            ?? new Date().toISOString().slice(0, 10);
        const totals = calculateCopqPeriodTotals(parsed.records, referenceDate);
        const syncedAt = new Date();
        await NcCopqFactRepository.replaceAll(input.dataSourceId, parsed.records, syncedAt, executor);
        await CopqAnalyticsMetaRepository.upsert({
            dataSourceId: input.dataSourceId,
            referenceDate: referenceDate.slice(0, 10),
            financialYearStart: totals?.financialYearStart
                ?? financialYearStartDate(referenceDate)
                ?? referenceDate.slice(0, 10),
            monthStart: totals?.monthStart
                ?? calendarMonthStart(referenceDate)
                ?? referenceDate.slice(0, 10),
            quarterStart: totals?.quarterStart
                ?? financialQuarterStartDate(referenceDate)
                ?? referenceDate.slice(0, 10),
            sheetName: metadataString(normalized, 'ncRecordsSheetName')
                ?? input.ncSheetName
                ?? String(input.config.ncRecordsSheetName ?? 'Form Responses 1'),
            sourceWorkbook: metadataString(normalized, 'sourceWorkbookName'),
            lastUpdated: metadataString(normalized, 'sourceLastUpdatedAt'),
            recordCount: parsed.records.length,
            rejectedRowCount: parsed.rejectedRowCount,
            dateColumnUsed: parsed.dateColumnUsed,
            copqColumnUsed: parsed.copqColumnUsed,
            headlineJson: extractCopqHeadline(normalized),
            syncedAt,
        }, executor);
        logger.info('copq analytics facts persisted', {
            operation: 'copq.analytics.persist',
            recordCount: parsed.records.length,
            rejectedRowCount: parsed.rejectedRowCount,
        });
        return { recordCount: parsed.records.length, rejectedRowCount: parsed.rejectedRowCount };
    }
    static async loadHeadlineIfAvailable(dataSourceId) {
        const meta = await CopqAnalyticsMetaRepository.findByDataSourceId(dataSourceId);
        return meta?.headlineJson ?? null;
    }
    static async loadFactsIfAvailable(dataSourceId) {
        const meta = await CopqAnalyticsMetaRepository.findByDataSourceId(dataSourceId);
        if (!meta || meta.recordCount === 0)
            return null;
        const records = await NcCopqFactRepository.listForDataSource(dataSourceId);
        if (records.length === 0)
            return null;
        return { records, meta };
    }
    static async loadDataSourceContext() {
        return loadCopqDataSourceContext();
    }
}
