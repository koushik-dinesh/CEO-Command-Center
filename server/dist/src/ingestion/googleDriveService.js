import { google } from 'googleapis';
import { createGoogleAuth } from './googleAuth.js';
export class GoogleDriveService {
    drive = google.drive({ version: 'v3', auth: createGoogleAuth() });
    async fetchLatestCsv(source) {
        const payloads = await this.fetchMatchingCsvs(source, 1);
        return payloads[0] ?? null;
    }
    async fetchMatchingCsvs(source, limit = 25) {
        const config = source.configJson;
        const queryParts = [`'${source.locationRef}' in parents`, 'trashed = false'];
        if (config.fileNamePattern)
            queryParts.push(`name contains '${config.fileNamePattern}'`);
        const listResponse = await this.drive.files.list({
            q: queryParts.join(' and '),
            fields: 'files(id,name,mimeType,modifiedTime,size)',
            orderBy: 'modifiedTime desc',
            pageSize: limit,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
        });
        const files = (listResponse.data.files ?? [])
            .filter((file) => file.id && file.name && (file.mimeType === 'text/csv' || file.name.toLowerCase().endsWith('.csv')));
        const payloads = await Promise.all(files.map(async (file) => {
            const contentResponse = await this.drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
            return {
                providerFileId: file.id,
                fileName: file.name,
                mimeType: file.mimeType ?? undefined,
                modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
                sizeBytes: file.size ? BigInt(file.size) : undefined,
                content: String(contentResponse.data),
            };
        }));
        return payloads;
    }
}
