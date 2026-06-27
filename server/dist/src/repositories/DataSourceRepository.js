import { queryRows } from '../db/mysql.js';
import { parseJsonField } from '../db/json.js';
function mapDataSource(row) {
    return { ...row, isActive: Boolean(row.isActive), configJson: parseJsonField(row.configJson) };
}
export class DataSourceRepository {
    static async activeSources() {
        const rows = await queryRows('SELECT * FROM data_sources WHERE isActive = 1 ORDER BY name ASC');
        return rows.map(mapDataSource);
    }
}
