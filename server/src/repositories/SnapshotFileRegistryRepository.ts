import type { RowDataPacket } from 'mysql2';
import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
import type { ReportType } from '../reports/types.js';

interface SnapshotFileRegistryDbRow extends RowDataPacket {
  id: string;
  providerFileId: string;
  fileName: string;
  reportType: ReportType;
  snapshotKey: string;
  snapshotDate: string;
  driveMd5Checksum: string | null;
  contentChecksum: string;
  status: 'PROCESSED' | 'FAILED' | 'SKIPPED';
  processedAt: Date;
}

export interface SnapshotFileRegistryRow {
  id: string;
  providerFileId: string;
  fileName: string;
  reportType: ReportType;
  snapshotKey: string;
  snapshotDate: string;
  driveMd5Checksum: string | null;
  contentChecksum: string;
  status: 'PROCESSED' | 'FAILED' | 'SKIPPED';
  processedAt: Date;
}

function mapRow(row: SnapshotFileRegistryDbRow): SnapshotFileRegistryRow {
  return { ...row };
}

export class SnapshotFileRegistryRepository {
  static async listAll(): Promise<Map<string, SnapshotFileRegistryRow>> {
    const rows = await queryRows<SnapshotFileRegistryDbRow>('SELECT * FROM snapshot_file_registry');
    return new Map(rows.map((row) => [row.providerFileId, mapRow(row)]));
  }

  static isRegistryEntryUnchanged(
    entry: SnapshotFileRegistryRow | undefined,
    driveMd5Checksum: string | null,
    contentChecksum?: string,
  ): boolean {
    if (!entry) return false;
    if (driveMd5Checksum && entry.driveMd5Checksum && entry.driveMd5Checksum === driveMd5Checksum) return true;
    if (contentChecksum && entry.contentChecksum === contentChecksum) return true;
    return false;
  }

  static async findByProviderFileId(providerFileId: string): Promise<SnapshotFileRegistryRow | null> {
    const row = await queryOne<SnapshotFileRegistryDbRow>(
      'SELECT * FROM snapshot_file_registry WHERE providerFileId = ? LIMIT 1',
      [providerFileId],
    );
    return row ? mapRow(row) : null;
  }

  static async isUnchanged(providerFileId: string, driveMd5Checksum: string | null, contentChecksum?: string): Promise<boolean> {
    const row = await this.findByProviderFileId(providerFileId);
    return this.isRegistryEntryUnchanged(row ?? undefined, driveMd5Checksum, contentChecksum);
  }

  static async upsert(data: {
    providerFileId: string;
    fileName: string;
    reportType: ReportType;
    snapshotKey: string;
    snapshotDate: string;
    driveMd5Checksum: string | null;
    contentChecksum: string;
    status?: 'PROCESSED' | 'FAILED' | 'SKIPPED';
  }): Promise<void> {
    const id = createId('sfr');
    const processedAt = new Date();
    await execute(
      `INSERT INTO snapshot_file_registry
       (id, providerFileId, fileName, reportType, snapshotKey, snapshotDate, driveMd5Checksum, contentChecksum, status, processedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         fileName = VALUES(fileName),
         reportType = VALUES(reportType),
         snapshotKey = VALUES(snapshotKey),
         snapshotDate = VALUES(snapshotDate),
         driveMd5Checksum = VALUES(driveMd5Checksum),
         contentChecksum = VALUES(contentChecksum),
         status = VALUES(status),
         processedAt = VALUES(processedAt),
         updatedAt = CURRENT_TIMESTAMP(3)`,
      [
        id,
        data.providerFileId,
        data.fileName,
        data.reportType,
        data.snapshotKey,
        data.snapshotDate,
        data.driveMd5Checksum,
        data.contentChecksum,
        data.status ?? 'PROCESSED',
        processedAt,
      ],
    );
  }
}
