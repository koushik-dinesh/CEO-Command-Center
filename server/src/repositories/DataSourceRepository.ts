import type { RowDataPacket } from 'mysql2';
import { queryRows } from '../db/mysql.js';
import { parseJsonField } from '../db/json.js';
import type { DataSourceRow, SourceProvider, SourceType } from '../db/types.js';

interface DataSourceDbRow extends RowDataPacket {
  id: string;
  code: string;
  name: string;
  sourceType: SourceType;
  provider: SourceProvider;
  locationRef: string;
  configJson: unknown;
  isActive: number;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapDataSource(row: DataSourceDbRow): DataSourceRow {
  return { ...row, isActive: Boolean(row.isActive), configJson: parseJsonField(row.configJson) };
}

export class DataSourceRepository {
  static async activeSources(): Promise<DataSourceRow[]> {
    const rows = await queryRows<DataSourceDbRow>('SELECT * FROM data_sources WHERE isActive = 1 ORDER BY name ASC');
    return rows.map(mapDataSource);
  }
}
