import { calculateCopqPeriodTotals } from './copqPeriods.js';
import { isO34SourceCell, metadataDecimal, metadataString } from './copqKpiValue.js';
import { CopqAnalyticsService } from './CopqAnalyticsService.js';
import { loadCopqDataSourceContext } from './copqNcParseConfig.js';
import { logO34Stage } from './o34PipelineTrace.js';
function asRecord(value) {
    return value && typeof value === 'object' ? { ...value } : {};
}
function hasO34Ytd(metadata) {
    if (!isO34SourceCell(metadataString(metadata, 'sourceCell')))
        return false;
    return metadataDecimal(metadata, 'copqYtd') != null || metadataDecimal(metadata, 'totalCopq') != null;
}
function applyHeadlineFields(enriched, headline) {
    for (const [key, value] of Object.entries(headline)) {
        if (value == null || value === '')
            continue;
        if (enriched[key] == null || enriched[key] === '') {
            enriched[key] = value;
        }
    }
}
export async function enrichCopqMetadataFromStaging(metadata) {
    const enriched = asRecord(metadata);
    const hasMtd = metadataDecimal(enriched, 'copqMtd') != null;
    const hasQtd = metadataDecimal(enriched, 'copqQtd') != null;
    const hasYtd = hasO34Ytd(enriched);
    if (hasMtd && hasQtd && hasYtd)
        return enriched;
    const sourceContext = await loadCopqDataSourceContext();
    const headline = sourceContext
        ? await CopqAnalyticsService.loadHeadlineIfAvailable(sourceContext.dataSourceId)
        : null;
    if (headline) {
        logO34Stage('COPQ META HEADLINE', {
            totalCopq: headline.totalCopq ?? null,
            sourceCell: headline.sourceCell ?? null,
        }, headline);
        applyHeadlineFields(enriched, headline);
    }
    else {
        logO34Stage('COPQ META HEADLINE', { found: false }, enriched);
    }
    if (hasMtd && hasQtd && hasO34Ytd(enriched)) {
        return enriched;
    }
    const referenceDate = metadataString(enriched, 'copqReferenceDate')
        ?? metadataString(headline, 'copqReferenceDate')
        ?? new Date().toISOString().slice(0, 10);
    const facts = sourceContext
        ? await CopqAnalyticsService.loadFactsIfAvailable(sourceContext.dataSourceId)
        : null;
    if (facts && facts.records.length > 0) {
        const totals = calculateCopqPeriodTotals(facts.records, referenceDate);
        if (totals) {
            if (!hasMtd)
                enriched.copqMtd = String(totals.copqMtd);
            if (!hasQtd)
                enriched.copqQtd = String(totals.copqQtd);
            if (!enriched.copqReferenceDate)
                enriched.copqReferenceDate = totals.referenceDate;
            if (!enriched.copqMonthStart)
                enriched.copqMonthStart = totals.monthStart;
            if (!enriched.copqQuarterStart)
                enriched.copqQuarterStart = totals.quarterStart;
            if (!enriched.copqMtdRowCount)
                enriched.copqMtdRowCount = String(totals.mtdRowCount);
            if (!enriched.copqQtdRowCount)
                enriched.copqQtdRowCount = String(totals.qtdRowCount);
            if (!enriched.copqMtdSourceKeys)
                enriched.copqMtdSourceKeys = totals.mtdSourceKeys.join(',');
            if (!enriched.copqQtdSourceKeys)
                enriched.copqQtdSourceKeys = totals.qtdSourceKeys.join(',');
        }
    }
    logO34Stage('COPQ META ENRICHED', {
        totalCopq: enriched.totalCopq ?? null,
        copqYtd: enriched.copqYtd ?? null,
        sourceCell: enriched.sourceCell ?? null,
        factsRecordCount: facts?.records.length ?? 0,
    }, enriched);
    return enriched;
}
