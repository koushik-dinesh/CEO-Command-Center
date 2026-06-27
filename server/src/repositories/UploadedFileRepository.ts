import type { RowDataPacket } from 'mysql2';
import type { DbExecutor } from '../db/mysql.js';
import { execute, queryOne } from '../db/mysql.js';
import { createId } from '../db/ids.js';
import type { ProcessingStatus, UploadedFileRow } from '../db/types.js';

interface UploadedFileDbRow extends RowDataPacket {
  id: string;
  dataSourceId: string;
  providerFileId: string;
  fileName: string;
  mimeType: string | null;
  checksum: string;
  modifiedTime: Date | null;
  sizeBytes: bigint | null;
  status: ProcessingStatus;
  createdAt: Date;
}

export class UploadedFileRepository {
  static findDuplicate(dataSourceId: string, providerFileId: string, checksum: string, executor?: DbExecutor): Promise<UploadedFileRow | null> {
    return queryOne<UploadedFileDbRow>(
      'SELECT * FROM uploaded_files WHERE dataSourceId = ? AND (providerFileId = ? OR checksum = ?) LIMIT 1',
      [dataSourceId, providerFileId, checksum],
      executor,
    );
  }

  static async create(data: Omit<UploadedFileRow, 'id' | 'createdAt'>, executor?: DbExecutor): Promise<UploadedFileRow> {
    const id = createId('file');
    await execute(
      `INSERT INTO uploaded_files (id, dataSourceId, providerFileId, fileName, mimeType, checksum, modifiedTime, sizeBytes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.dataSourceId, data.providerFileId, data.fileName, data.mimeType, data.checksum, data.modifiedTime, data.sizeBytes?.toString() ?? null, data.status],
      executor,
    );
    return { ...data, id, createdAt: new Date() };
  }

  static async updateStatus(id: string, status: ProcessingStatus, executor?: DbExecutor): Promise<void> {
    await execute('UPDATE uploaded_files SET status = ? WHERE id = ?', [status, id], executor);
  }
}
