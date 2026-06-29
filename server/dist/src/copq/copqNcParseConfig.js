import { parseJsonField } from '../db/json.js';
import { queryOne } from '../db/mysql.js';
function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
export async function loadCopqDataSourceContext() {
    const row = await queryOne(`SELECT id, configJson FROM data_sources WHERE code = 'COPQ_DASHBOARD_SHEET' AND isActive = 1 LIMIT 1`);
    if (!row)
        return null;
    const config = asRecord(parseJsonField(row.configJson));
    const parseConfig = {
        copqColumn: String(config.ncCopqColumn ?? 'FINAL COPQ'),
        dateColumn: String(config.ncDateColumn ?? 'NC DATE'),
        dateColumnFallbacks: Array.isArray(config.ncDateColumnFallbacks)
            ? config.ncDateColumnFallbacks.map(String)
            : ['Timestamp', 'Date'],
        sourceKeyColumn: String(config.ncSourceKeyColumn ?? 'QC NC number'),
        ncNumberColumn: String(config.ncNumberColumn ?? 'QC NC number'),
        productColumn: String(config.productColumn ?? 'Product name'),
        departmentColumn: String(config.departmentColumn ?? 'QC Location'),
        rootCauseColumn: String(config.rootCauseColumn ?? 'Reason For Rejection'),
        rootCauseFallbackColumn: String(config.rootCauseFallbackColumn ?? 'Complaint name'),
        categoryColumn: String(config.categoryColumn ?? 'Issue Related to'),
        statusColumn: String(config.statusColumn ?? 'Status'),
        beforeQaCopqColumn: String(config.beforeQaCopqColumn ?? 'QC COPQ'),
    };
    return { dataSourceId: row.id, config, parseConfig };
}
