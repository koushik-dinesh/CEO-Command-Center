import { useState } from 'react';
import type { SyncHistorySnapshot } from '../../types/command-center';
import { formatSyncSessionTime, formatSyncTypeLabel } from '../../utils/formatters';

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`cc-sync-history-chevron${expanded ? ' is-expanded' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25" className="cc-sync-history-icon-success" />
      <path
        d="M4.25 7.1 6.1 8.95 9.75 5.3"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="cc-sync-history-icon-success"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25" className="cc-sync-history-icon-error" />
      <path
        d="M5 5l4 4M9 5 5 9"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        className="cc-sync-history-icon-error"
      />
    </svg>
  );
}

export default function FetchingActivityPanel({
  syncHistory,
  isRefreshing,
}: {
  syncHistory: SyncHistorySnapshot;
  isRefreshing?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sessions = syncHistory.sessions;

  const toggleSession = (sessionId: string) => {
    setExpandedId((current) => (current === sessionId ? null : sessionId));
  };

  return (
    <section className="cc-sync-history dashboard-panel p-5" aria-label="Sync history">
      <div className="cc-sync-history-head">
        <div>
          <p className="eyebrow">Fetching Activity</p>
          <h3 className="cc-panel-title mt-1">Sync History</h3>
          <p className="mt-1 text-xs text-secondary-theme">
            Today&apos;s sync sessions and the business files processed in each run.
          </p>
        </div>
        {isRefreshing ? (
          <span className="cc-sync-history-badge" aria-live="polite">
            Syncing…
          </span>
        ) : null}
      </div>

      {sessions.length > 0 ? (
        <ul className="cc-sync-history-list">
          {sessions.map((session) => {
            const expanded = expandedId === session.id;
            const panelId = `sync-history-panel-${session.id}`;
            const fileCount = session.totalFilesProcessed;

            return (
              <li key={session.id} className="cc-sync-history-item">
                <button
                  type="button"
                  className="cc-sync-history-row"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggleSession(session.id)}
                >
                  <span className="cc-sync-history-source">{session.source}</span>
                  <span className="cc-sync-history-meta">
                    <time className="cc-sync-history-time" dateTime={session.completedAt}>
                      {formatSyncSessionTime(session.completedAt)}
                    </time>
                    <span className="cc-sync-history-type">{formatSyncTypeLabel(session.syncType)}</span>
                    <span className="cc-sync-history-count">
                      {fileCount} {fileCount === 1 ? 'File' : 'Files'}
                    </span>
                  </span>
                  <span className="cc-sync-history-chevron-wrap">
                    <ChevronIcon expanded={expanded} />
                  </span>
                </button>

                <div
                  id={panelId}
                  className={`cc-sync-history-body${expanded ? ' is-expanded' : ''}`}
                  aria-hidden={!expanded}
                >
                  <div className="cc-sync-history-body-inner">
                    {session.files.length > 0 ? (
                      <ul className="cc-sync-history-files">
                        {session.files.map((file) => (
                          <li key={`${session.id}-${file.name}`} className="cc-sync-history-file">
                            <span className="cc-sync-history-file-icon">
                              {file.status === 'failed' ? <ErrorIcon /> : <SuccessIcon />}
                            </span>
                            <span className="cc-sync-history-file-name">{file.name}</span>
                            {file.status === 'failed' && file.error ? (
                              <span className="cc-sync-history-file-error" title={file.error}>
                                {file.error}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="cc-sync-history-files-empty text-sm text-secondary-theme">
                        No files were fetched during this sync.
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cc-sync-history-empty text-sm text-secondary-theme">
          No sync sessions today. Run Sync &amp; Refresh to fetch data from Google Drive and Sheets.
        </p>
      )}
    </section>
  );
}
