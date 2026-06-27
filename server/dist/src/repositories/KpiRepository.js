import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
import { parseJsonField } from '../db/json.js';
function mapDefinition(row) {
    return { ...row, isActive: Boolean(row.isActive), configJson: row.configJson === null ? null : parseJsonField(row.configJson) };
}
function mapKpiValue(row) {
    if (!row)
        return null;
    return { ...row, metadataJson: row.metadataJson === null ? null : parseJsonField(row.metadataJson) };
}
export class KpiRepository {
    static async activeDefinitions() {
        const rows = await queryRows('SELECT * FROM kpi_definitions WHERE isActive = 1 ORDER BY sortOrder ASC');
        return rows.map(mapDefinition);
    }
    static async latestValue(kpiDefinitionId) {
        const row = await queryOne('SELECT * FROM kpi_values WHERE kpiDefinitionId = ? ORDER BY calculatedAt DESC LIMIT 1', [kpiDefinitionId]);
        return mapKpiValue(row);
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
        const rows = await queryRows('SELECT * FROM kpi_values WHERE kpiDefinitionId = ? AND valueDecimal IS NOT NULL ORDER BY calculatedAt DESC LIMIT ?', [kpiDefinitionId, limit]);
        return rows.map((row) => mapKpiValue(row));
    }
    static async createValue(data) {
        const id = createId('kval');
        const calculatedAt = new Date();
        await execute(`INSERT INTO kpi_values
       (id, kpiDefinitionId, periodStart, periodEnd, valueDecimal, previousValueDecimal, changePercent, trendDirection, status, sourceRunId, metadataJson, calculatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            id,
            data.kpiDefinitionId,
            data.periodStart,
            data.periodEnd,
            data.valueDecimal,
            data.previousValueDecimal,
            data.changePercent,
            data.trendDirection,
            data.status,
            data.sourceRunId ?? null,
            data.metadataJson ? JSON.stringify(data.metadataJson) : null,
            calculatedAt,
        ]);
        const created = await queryOne('SELECT * FROM kpi_values WHERE id = ? LIMIT 1', [id]);
        const mapped = mapKpiValue(created);
        if (!mapped)
            throw new Error(`KPI value ${id} not found after insert`);
        return mapped;
    }
}
