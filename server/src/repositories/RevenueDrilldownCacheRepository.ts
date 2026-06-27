import type { RowDataPacket } from 'mysql2';
import { createId } from '../db/ids.js';
import { parseJsonField, stringifyJson } from '../db/json.js';
import { execute, queryOne } from '../db/mysql.js';
import type { RevenueDrilldownResponse } from '../revenue/revenue-types.js';

interface RevenueDrilldownCacheDbRow extends RowDataPacket {
  id: string;
  providerFileId: string;
  fileName: string;
  mimeType: string | null;
  modifiedTime: Date | null;
  sizeBytes: bigint | null;
  fileDate: string;
  fileTimestamp: string;
  checksum: string;
  payloadJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueDrilldownCacheRow {
  id: string;
  providerFileId: string;
  fileName: string;
  mimeType: string | null;
  modifiedTime: Date | null;
  sizeBytes: bigint | null;
  fileDate: string;
  fileTimestamp: string;
  checksum: string;
  payloadJson: RevenueDrilldownResponse;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: RevenueDrilldownCacheDbRow | null): RevenueDrilldownCacheRow | null {
  if (!row) return null;
  return { ...row, payloadJson: parseJsonField<RevenueDrilldownResponse>(row.payloadJson) };
}

export class RevenueDrilldownCacheRepository {
  static async latest(): Promise<RevenueDrilldownCacheRow | null> {
    const row = await queryOne<RevenueDrilldownCacheDbRow>(
      'SELECT * FROM revenue_drilldown_cache ORDER BY fileTimestamp DESC, updatedAt DESC LIMIT 1',
    );
    return mapRow(row);
  }

  static async upsert(data: {
    providerFileId: string;
    fileName: string;
    mimeType: string | null;
    modifiedTime: Date | null;
    sizeBytes: bigint | null;
    fileDate: string;
    fileTimestamp: string;
    checksum: string;
    payloadJson: RevenueDrilldownResponse;
  }): Promise<RevenueDrilldownCacheRow> {
    const id = createId('rev_cache');
    await execute(
      `INSERT INTO revenue_drilldown_cache
       (id, providerFileId, fileName, mimeType, modifiedTime, sizeBytes, fileDate, fileTimestamp, checksum, payloadJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         fileName = VALUES(fileName),
         mimeType = VALUES(mimeType),
         modifiedTime = VALUES(modifiedTime),
         sizeBytes = VALUES(sizeBytes),
         fileDate = VALUES(fileDate),
         fileTimestamp = VALUES(fileTimestamp),
         checksum = VALUES(checksum),
         payloadJson = VALUES(payloadJson),
         updatedAt = CURRENT_TIMESTAMP(3)`,
      [
        id,
        data.providerFileId,
        data.fileName,
        data.mimeType,
        data.modifiedTime,
        data.sizeBytes?.toString() ?? null,
        data.fileDate,
        data.fileTimestamp,
        data.checksum,
        stringifyJson(data.payloadJson),
      ],
    );

    const row = await queryOne<RevenueDrilldownCacheDbRow>('SELECT * FROM revenue_drilldown_cache WHERE providerFileId = ? LIMIT 1', [data.providerFileId]);
    const mapped = mapRow(row);
    if (!mapped) throw new Error(`Revenue drilldown cache ${data.providerFileId} not found after upsert`);
    return mapped;
  }
}
