import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import { SourceProvider, SourceType } from '../db/types.js';
import { createGoogleAuth } from '../ingestion/googleAuth.js';
import { DataSourceService } from './DataSourceService.js';
function isPlaceholderFolderId(value) {
    return /placeholder|google-drive-folder-id/i.test(value);
}
function isCsvFile(file) {
    return file.mimeType === 'text/csv' || Boolean(file.name?.toLowerCase().endsWith('.csv'));
}
function parseCsvPreview(content) {
    const rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
    });
    return {
        columns: rows[0] ? Object.keys(rows[0]) : [],
        rows: rows.slice(0, 5),
    };
}
export class DriveExplorerService {
    drive = google.drive({ version: 'v3', auth: createGoogleAuth() });
    async listConfiguredDriveFiles() {
        const sources = await DataSourceService.activeSources();
        const driveSources = this.uniqueDriveFolders(sources);
        const folders = await Promise.all(driveSources.map((source) => this.listSourceFolder(source)));
        return { folders, generatedAt: new Date().toISOString() };
    }
    uniqueDriveFolders(sources) {
        const seen = new Set();
        return sources.filter((source) => {
            if (source.provider !== SourceProvider.GOOGLE_DRIVE || source.sourceType !== SourceType.CSV)
                return false;
            const key = source.locationRef;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    async listSourceFolder(source) {
        if (!source.locationRef || isPlaceholderFolderId(source.locationRef)) {
            return {
                sourceCode: source.code,
                sourceName: source.name,
                folderId: source.locationRef,
                status: 'not_configured',
                error: `Data source ${source.code} still has placeholder folder ID: ${source.locationRef}`,
                files: [],
            };
        }
        try {
            const response = await this.drive.files.list({
                q: `'${source.locationRef}' in parents and trashed = false`,
                fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents)',
                orderBy: 'folder,name',
                pageSize: 100,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
            });
            const files = await Promise.all((response.data.files ?? []).map(async (file) => {
                let csvPreview = null;
                let readError = null;
                if (file.id && isCsvFile(file)) {
                    try {
                        const contentResponse = await this.drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
                        csvPreview = parseCsvPreview(String(contentResponse.data));
                    }
                    catch (error) {
                        readError = error instanceof Error ? error.message : 'Unknown CSV read error';
                    }
                }
                return {
                    id: file.id ?? '',
                    name: file.name ?? '',
                    mimeType: file.mimeType ?? 'unknown',
                    size: file.size ?? null,
                    createdTime: file.createdTime ?? null,
                    modifiedTime: file.modifiedTime ?? null,
                    webViewLink: file.webViewLink ?? null,
                    parents: file.parents ?? [],
                    csvPreview,
                    readError,
                };
            }));
            return {
                sourceCode: source.code,
                sourceName: source.name,
                folderId: source.locationRef,
                status: 'success',
                error: null,
                files,
            };
        }
        catch (error) {
            return {
                sourceCode: source.code,
                sourceName: source.name,
                folderId: source.locationRef,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown Google Drive error',
                files: [],
            };
        }
    }
}
