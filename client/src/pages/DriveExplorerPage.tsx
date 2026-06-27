import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { DriveExplorerResponse } from '../types';
import { formatDateTime } from '../utils/formatters';

function formatFileSize(size: string | null): string {
  if (!size) return 'Not reported';
  const bytes = Number(size);
  if (Number.isNaN(bytes)) return size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DriveExplorerPage() {
  const [data, setData] = useState<DriveExplorerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadFiles() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.driveExplorerFiles();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Google Drive files');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
  }, []);

  const totals = useMemo(() => {
    const folders = data?.folders ?? [];
    return {
      folderCount: folders.length,
      fileCount: folders.reduce((count, folder) => count + folder.files.length, 0),
      readableCsvCount: folders.reduce((count, folder) => count + folder.files.filter((file) => file.csvPreview && !file.readError).length, 0),
      failedReadCount: folders.reduce((count, folder) => count + folder.files.filter((file) => file.readError).length, 0),
    };
  }, [data]);

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 piano-card rounded-2xl p-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-[var(--text-muted)]">Data Verification</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Source File Explorer</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Lists configured Drive folders and previews the first 5 rows of readable CSV files.</p>
          {data ? <p className="mt-1 text-xs text-[var(--text-muted)]">Generated {formatDateTime(data.generatedAt)}</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/" className="piano-button-secondary px-5 py-3 text-sm font-semibold">
            Back to dashboard
          </Link>
          <button
            type="button"
            onClick={() => void loadFiles()}
            disabled={isLoading}
            className="piano-button px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <p className="mb-6 rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="piano-card rounded-2xl p-5"><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Folders</p><p className="mt-2 text-2xl font-semibold">{totals.folderCount}</p></div>
        <div className="piano-card rounded-2xl p-5"><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Files</p><p className="mt-2 text-2xl font-semibold">{totals.fileCount}</p></div>
        <div className="piano-card rounded-2xl p-5"><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Readable CSVs</p><p className="mt-2 text-2xl font-semibold">{totals.readableCsvCount}</p></div>
        <div className="piano-card rounded-2xl p-5"><p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Read Failures</p><p className="mt-2 text-2xl font-semibold">{totals.failedReadCount}</p></div>
      </div>

      {isLoading && !data ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />)}
        </div>
      ) : null}

      <div className="space-y-6">
        {data?.folders.map((folder) => (
          <section key={`${folder.sourceCode}-${folder.folderId}`} className="piano-card rounded-2xl p-6">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{folder.sourceCode}</p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{folder.sourceName}</h3>
                <p className="mt-1 break-all text-sm text-[var(--text-secondary)]">Folder ID: {folder.folderId}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${folder.status === 'success' ? 'bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-[var(--success)]' : 'bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-[var(--warning)]'}`}>
                {folder.status.replace('_', ' ')}
              </span>
            </div>

            {folder.error ? <p className="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-3 text-sm text-[var(--danger)]">{folder.error}</p> : null}

            {folder.files.length > 0 ? (
              <div className="mt-5 space-y-4">
                {folder.files.map((file) => (
                  <article key={file.id} className="piano-card rounded-2xl p-5">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">File Name</p>
                        <p className="mt-1 font-medium text-[var(--text-primary)]">{file.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">File ID</p>
                        <p className="mt-1 break-all text-sm text-[var(--text-secondary)]">{file.id}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">File Type</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{file.mimeType}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">File Size</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatFileSize(file.size)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Created Time</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDateTime(file.createdTime)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Modified Time</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDateTime(file.modifiedTime)}</p>
                      </div>
                    </div>

                    {file.readError ? <p className="mt-4 rounded-lg bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-[var(--danger)]">CSV read error: {file.readError}</p> : null}

                    {file.csvPreview ? (
                      <div className="mt-4 premium-scrollbar overflow-x-auto rounded-2xl border border-[var(--border-subtle)]">
                        <table className="min-w-full text-left text-xs text-[var(--text-secondary)]">
                          <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                            <tr>{file.csvPreview.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>)}</tr>
                          </thead>
                          <tbody>
                            {file.csvPreview.rows.length === 0 ? (
                              <tr><td className="px-3 py-3 text-[var(--text-muted)]" colSpan={Math.max(file.csvPreview.columns.length, 1)}>CSV read succeeded, but no rows were found.</td></tr>
                            ) : file.csvPreview.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-t border-[var(--border-subtle)]">
                                {file.csvPreview?.columns.map((column) => <td key={column} className="whitespace-nowrap px-3 py-2">{row[column] ?? ''}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : folder.status === 'success' ? <p className="mt-4 text-sm text-[var(--text-secondary)]">No files found in this folder.</p> : null}
          </section>
        ))}
      </div>
    </>
  );
}
