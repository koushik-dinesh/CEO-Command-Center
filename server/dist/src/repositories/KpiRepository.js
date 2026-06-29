import { createId } from '../db/ids.js';
import { parseJsonField } from '../db/json.js';
import { queryOne, queryRows } from '../db/mysql.js';
import { AnalyticsStorageService } from '../analytics/AnalyticsStorageService.js';
import { KpiCurrentRepository } from './KpiCurrentRepository.js';
import { KpiHistoryRepository, mapKpiCurrentToValue } from './KpiHistoryRepository.js';
function mapDefinition(row) {
    return { ...row, isActive: Boolean(row.isActive), configJson: row.configJson === null ? null : parseJsonField(row.configJson) };
}
export class KpiRepository {
    static async activeDefinitions() {
        const rows = await queryRows('SELECT * FROM kpi_definitions WHERE isActive = 1 ORDER BY sortOrder ASC');
        return rows.map(mapDefinition);
    }
    static async latestValue(kpiDefinitionId) {
        const current = await KpiCurrentRepository.findByDefinitionId(kpiDefinitionId);
        return current ? mapKpiCurrentToValue(current) : null;
    }
    static async findDefinitionByCode(code) {
        const row = await queryOne('SELECT * FROM kpi_definitions WHERE code = ? AND isActive = 1 LIMIT 1', [code]);
        return row ? mapDefinition(row) : null;
    }
    static async latestValueByCode(code) {
        const definition = await this.findDefinitionByCode(code);
        if (!definition)
            return null;
        const value = await this.latestValue(definition.id);
        if (!value)
            return null;
        return { definition, value };
    }
    static async history(kpiDefinitionId, limit = 8) {
        return KpiHistoryRepository.listForDefinition(kpiDefinitionId, limit);
    }
    static async persistKpi(kpiCode, data) {
        const calculatedAt = new Date();
        const value = {
            id: createId('kcur'),
            kpiDefinitionId: data.kpiDefinitionId,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            valueDecimal: data.valueDecimal,
            previousValueDecimal: data.previousValueDecimal,
            changePercent: data.changePercent,
            trendDirection: data.trendDirection,
            status: data.status,
            sourceRunId: data.sourceRunId ?? null,
            metadataJson: data.metadataJson ?? null,
            calculatedAt,
            createdAt: calculatedAt,
        };
        await AnalyticsStorageService.persistKpi(kpiCode, value);
        return value;
    }
}
