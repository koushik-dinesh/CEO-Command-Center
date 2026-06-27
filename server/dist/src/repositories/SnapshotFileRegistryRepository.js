import { createId } from '../db/ids.js';
import { execute, queryOne, queryRows } from '../db/mysql.js';
function mapRow(row) {
    return { ...row };
}
export class SnapshotFileRegistryRepository {
    static async listAll() {
        const rows = await queryRows('SELECT * FROM snapshot_file_registry');
        return new Map(rows.map((row) => [row.providerFileId, mapRow(row)]));
    }
    static isRegistryEntryUnchanged(entry, driveMd5Checksum, contentChecksum) {
        if (!entry)
            return false;
        if (driveMd5Checksum && entry.driveMd5Checksum && entry.driveMd5Checksum === driveMd5Checksum)
            return true;
        if (contentChecksum && entry.contentChecksum === contentChecksum)
            return true;
        return false;
    }
    static async findByProviderFileId(providerFileId) {
        const row = await queryOne('SELECT * FROM snapshot_file_registry WHERE providerFileId = ? LIMIT 1', [providerFileId]);
        return row ? mapRow(row) : null;
    }
    static async isUnchanged(providerFileId, driveMd5Checksum, contentChecksum) {
        const row = await this.findByProviderFileId(providerFileId);
        return this.isRegistryEntryUnchanged(row ?? undefined, driveMd5Checksum, contentChecksum);
    }
    static async upsert(data) {
        const id = createId('sfr');
        const processedAt = new Date();
        await execute(`INSERT INTO snapshot_file_registry
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
         updatedAt = CURRENT_TIMESTAMP(3)`, [
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
        ]);
    }
}
