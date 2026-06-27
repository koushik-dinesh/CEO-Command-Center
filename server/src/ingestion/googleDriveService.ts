import type { DataSourceRow as DataSource } from '../db/types.js';
import { google } from 'googleapis';
import { createGoogleAuth } from './googleAuth.js';
import type { SourceConfig, SourcePayload } from './types.js';

export class GoogleDriveService {
  private drive = google.drive({ version: 'v3', auth: createGoogleAuth() });

  async fetchLatestCsv(source: DataSource): Promise<SourcePayload | null> {
    const payloads = await this.fetchMatchingCsvs(source, 1);
    return payloads[0] ?? null;
  }

  async fetchMatchingCsvs(source: DataSource, limit = 25): Promise<SourcePayload[]> {
    const config = source.configJson as unknown as SourceConfig;
    const queryParts = [`'${source.locationRef}' in parents`, 'trashed = false'];
    if (config.fileNamePattern) queryParts.push(`name contains '${config.fileNamePattern}'`);

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

    return Promise.all(files.map(async (file) => {
      const contentResponse = await this.drive.files.get({ fileId: file.id!, alt: 'media' }, { responseType: 'text' });
      return {
        providerFileId: file.id!,
        fileName: file.name!,
        mimeType: file.mimeType ?? undefined,
        modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
        sizeBytes: file.size ? BigInt(file.size) : undefined,
        content: String(contentResponse.data),
      };
    }));
  }
}
