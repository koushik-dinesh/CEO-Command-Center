import { parseJsonField, stringifyJson } from '../db/json.js';
import { execute, queryOne } from '../db/mysql.js';
function mapRow(row) {
    return {
        ...row,
        metadataJson: row.metadataJson === null ? null : parseJsonField(row.metadataJson),
    };
}
export class KpiCurrentRepository {
    static async upsertFromValue(kpiCode, value) {
        await execute(`INSERT INTO kpi_current
       (kpiDefinitionId, kpiCode, periodStart, periodEnd, valueDecimal, previousValueDecimal,
        changePercent, trendDirection, status, sourceRunId, metadataJson, calculatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         kpiCode = VALUES(kpiCode),
         periodStart = VALUES(periodStart),
         periodEnd = VALUES(periodEnd),
         valueDecimal = VALUES(valueDecimal),
         previousValueDecimal = VALUES(previousValueDecimal),
         changePercent = VALUES(changePercent),
         trendDirection = VALUES(trendDirection),
         status = VALUES(status),
         sourceRunId = VALUES(sourceRunId),
         metadataJson = VALUES(metadataJson),
         calculatedAt = VALUES(calculatedAt),
         updatedAt = CURRENT_TIMESTAMP(3)`, [
            value.kpiDefinitionId,
            kpiCode,
            value.periodStart,
            value.periodEnd,
            value.valueDecimal,
            value.previousValueDecimal,
            value.changePercent,
            value.trendDirection,
            value.status,
            value.sourceRunId,
            value.metadataJson ? stringifyJson(value.metadataJson) : null,
            value.calculatedAt,
        ]);
        const row = await queryOne('SELECT * FROM kpi_current WHERE kpiDefinitionId = ? LIMIT 1', [value.kpiDefinitionId]);
        if (!row)
            throw new Error(`kpi_current row missing after upsert for ${kpiCode}`);
        return mapRow(row);
    }
    static async findByCode(kpiCode) {
        const row = await queryOne('SELECT * FROM kpi_current WHERE kpiCode = ? LIMIT 1', [kpiCode]);
        return row ? mapRow(row) : null;
    }
    static async findByDefinitionId(kpiDefinitionId) {
        const row = await queryOne('SELECT * FROM kpi_current WHERE kpiDefinitionId = ? LIMIT 1', [kpiDefinitionId]);
        return row ? mapRow(row) : null;
    }
}
