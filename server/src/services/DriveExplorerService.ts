import { google } from 'googleapis';
import { parse } from 'csv-parse/sync';
import { SourceProvider, SourceType, type DataSourceRow } from '../db/types.js';
import { createGoogleAuth } from '../ingestion/googleAuth.js';
import { DataSourceService } from './DataSourceService.js';

interface CsvPreview {
  columns: string[];
  rows: Record<string, string>[];
}

interface ExplorerFile {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  createdTime: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  parents: string[];
  csvPreview: CsvPreview | null;
  readError: string | null;
}

interface ExplorerFolderResult {
  sourceCode: string;
  sourceName: string;
  folderId: string;
  status: 'success' | 'failed' | 'not_configured';
  error: string | null;
  files: ExplorerFile[];
}

function isPlaceholderFolderId(value: string): boolean {
  return /placeholder|google-drive-folder-id/i.test(value);
}

function isCsvFile(file: { mimeType?: string | null; name?: string | null }): boolean {
  return file.mimeType === 'text/csv' || Boolean(file.name?.toLowerCase().endsWith('.csv'));
}

function parseCsvPreview(content: string): CsvPreview {
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
  return {
    columns: rows[0] ? Object.keys(rows[0]) : [],
    rows: rows.slice(0, 5),
  };
}

export class DriveExplorerService {
  private drive = google.drive({ version: 'v3', auth: createGoogleAuth() });

  async listConfiguredDriveFiles(): Promise<{ folders: ExplorerFolderResult[]; generatedAt: string }> {
    const sources = await DataSourceService.activeSources();
    const driveSources = this.uniqueDriveFolders(sources);
    const folders = await Promise.all(driveSources.map((source) => this.listSourceFolder(source)));
    return { folders, generatedAt: new Date().toISOString() };
  }

  private uniqueDriveFolders(sources: DataSourceRow[]): DataSourceRow[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      if (source.provider !== SourceProvider.GOOGLE_DRIVE || source.sourceType !== SourceType.CSV) return false;
      const key = source.locationRef;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async listSourceFolder(source: DataSourceRow): Promise<ExplorerFolderResult> {
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
        let csvPreview: CsvPreview | null = null;
        let readError: string | null = null;

        if (file.id && isCsvFile(file)) {
          try {
            const contentResponse = await this.drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'text' });
            csvPreview = parseCsvPreview(String(contentResponse.data));
          } catch (error) {
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
        } satisfies ExplorerFile;
      }));

      return {
        sourceCode: source.code,
        sourceName: source.name,
        folderId: source.locationRef,
        status: 'success',
        error: null,
        files,
      };
    } catch (error) {
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
