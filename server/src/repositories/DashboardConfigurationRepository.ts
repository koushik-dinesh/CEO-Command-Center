import type { RowDataPacket } from 'mysql2';
import { queryOne } from '../db/mysql.js';
import { parseJsonField } from '../db/json.js';
import type { DashboardConfigurationRow } from '../db/types.js';

interface DashboardConfigurationDbRow extends RowDataPacket {
  id: string;
  name: string;
  isDefault: number;
  layoutJson: unknown;
  refreshIntervalSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

function mapConfig(row: DashboardConfigurationDbRow | null): DashboardConfigurationRow | null {
  if (!row) return null;
  return { ...row, isDefault: Boolean(row.isDefault), layoutJson: parseJsonField(row.layoutJson) };
}

export class DashboardConfigurationRepository {
  static async defaultConfig(): Promise<DashboardConfigurationRow | null> {
    return mapConfig(await queryOne<DashboardConfigurationDbRow>('SELECT * FROM dashboard_configurations WHERE isDefault = 1 LIMIT 1'));
  }
}
