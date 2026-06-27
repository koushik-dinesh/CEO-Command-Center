import { queryOne } from '../db/mysql.js';
import { parseJsonField } from '../db/json.js';
function mapConfig(row) {
    if (!row)
        return null;
    return { ...row, isDefault: Boolean(row.isDefault), layoutJson: parseJsonField(row.layoutJson) };
}
export class DashboardConfigurationRepository {
    static async defaultConfig() {
        return mapConfig(await queryOne('SELECT * FROM dashboard_configurations WHERE isDefault = 1 LIMIT 1'));
    }
}
