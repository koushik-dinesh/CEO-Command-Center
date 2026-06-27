import { execute, queryOne } from '../db/mysql.js';
import { createId } from '../db/ids.js';
export class UploadedFileRepository {
    static findDuplicate(dataSourceId, providerFileId, checksum, executor) {
        return queryOne('SELECT * FROM uploaded_files WHERE dataSourceId = ? AND (providerFileId = ? OR checksum = ?) LIMIT 1', [dataSourceId, providerFileId, checksum], executor);
    }
    static async create(data, executor) {
        const id = createId('file');
        await execute(`INSERT INTO uploaded_files (id, dataSourceId, providerFileId, fileName, mimeType, checksum, modifiedTime, sizeBytes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, data.dataSourceId, data.providerFileId, data.fileName, data.mimeType, data.checksum, data.modifiedTime, data.sizeBytes?.toString() ?? null, data.status], executor);
        return { ...data, id, createdAt: new Date() };
    }
    static async updateStatus(id, status, executor) {
        await execute('UPDATE uploaded_files SET status = ? WHERE id = ?', [status, id], executor);
    }
}
