import { Decimal } from 'decimal.js';
import { filterO34CopqHistory } from '../copq/copqKpiValue.js';
import { logO34Stage } from '../copq/o34PipelineTrace.js';
import { CopqAnalyticsService } from '../copq/CopqAnalyticsService.js';
import { loadCopqDataSourceContext } from '../copq/copqNcParseConfig.js';
import { isDuplicateStagingSource } from './duplicateStagingSources.js';
import { loadLatestSnapshotKpiContext } from './snapshotKpiContext.js';
import { KpiStatus, TrendDirection } from '../db/types.js';
import { KpiRepository } from '../repositories/KpiRepository.js';
import { StagingRecordRepository } from '../repositories/StagingRecordRepository.js';
import { getCurrentReportingPeriod } from '../utils/dates.js';
import { getCalculator } from './registry.js';
function trendFor(value, previous) {
    if (!value || !previous)
        return TrendDirection.UNKNOWN;
    const previousDecimal = new Decimal(previous);
    if (value.gt(previousDecimal))
        return TrendDirection.UP;
    if (value.lt(previousDecimal))
        return TrendDirection.DOWN;
    return TrendDirection.FLAT;
}
function changePercent(value, previous) {
    if (!value || !previous)
        return null;
    const previousDecimal = new Decimal(previous);
    if (previousDecimal.equals(0))
        return null;
    return value.minus(previousDecimal).div(previousDecimal.abs()).mul(100).toDecimalPlaces(4).toString();
}
export class KpiCalculationService {
    async calculateAndPersist(options = {}) {
        const codesToCalculate = options.codes ?? [];
        if (codesToCalculate.length === 0)
            return [];
        const { periodStart, periodEnd } = getCurrentReportingPeriod();
        const stagingRecords = await StagingRecordRepository.findForPeriod(periodStart, periodEnd);
        const snapshotContext = await loadLatestSnapshotKpiContext();
        const copqSourceContext = await loadCopqDataSourceContext();
        const copqHeadline = copqSourceContext
            ? await CopqAnalyticsService.loadHeadlineIfAvailable(copqSourceContext.dataSourceId)
            : null;
        const recordsBySource = new Map();
        for (const record of stagingRecords) {
            if (isDuplicateStagingSource(record.dataSourceCode))
                continue;
            const list = recordsBySource.get(record.dataSourceCode) ?? [];
            list.push({ sourceDate: record.sourceDate, sourceKey: record.sourceKey, normalized: record.normalized });
            recordsBySource.set(record.dataSourceCode, list);
        }
        const context = { recordsBySource, snapshotContext, copqHeadline };
        const definitions = await KpiRepository.activeDefinitions();
        const persisted = [];
        const targetCodes = new Set(codesToCalculate);
        for (const definition of definitions) {
            if (!targetCodes.has(definition.code))
                continue;
            const calculator = getCalculator(definition.code);
            if (!calculator)
                continue;
            const result = calculator.calculate(context);
            const latest = await KpiRepository.latestValue(definition.id);
            const previousRow = definition.code === 'COPQ'
                ? filterO34CopqHistory(await KpiRepository.history(definition.id, 48))[0] ?? latest
                : latest;
            const valueString = result.value?.toDecimalPlaces(4).toString() ?? null;
            const created = await KpiRepository.persistKpi(definition.code, {
                kpiDefinitionId: definition.id,
                periodStart,
                periodEnd,
                valueDecimal: valueString,
                previousValueDecimal: previousRow?.valueDecimal ?? null,
                changePercent: changePercent(result.value, previousRow?.valueDecimal),
                trendDirection: trendFor(result.value, previousRow?.valueDecimal),
                status: result.status ?? KpiStatus.CURRENT,
                sourceRunId: options.sourceRunId,
                metadataJson: result.metadataJson,
            });
            if (definition.code === 'COPQ') {
                const copqRecords = recordsBySource.get('COPQ_DASHBOARD_SHEET') ?? [];
                const latestStaging = copqRecords[copqRecords.length - 1];
                logO34Stage('KPI VALUE GENERATION O34', {
                    status: result.status,
                    valueDecimal: valueString,
                    stagingTotalCopq: latestStaging?.normalized?.totalCopq ?? null,
                    stagingSourceCell: latestStaging?.normalized?.sourceCell ?? null,
                    metadataTotalCopq: result.metadataJson?.totalCopq ?? null,
                    metadataSourceCell: result.metadataJson?.sourceCell ?? null,
                }, (result.metadataJson ?? {}));
                console.info(`[kpi:copq] KPI updated: value=${created.valueDecimal ?? 'null'} status=${created.status}`);
            }
            persisted.push(created);
        }
        return persisted;
    }
}
