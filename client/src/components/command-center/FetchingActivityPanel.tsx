import type { FetchActivitySnapshot } from '../../types/command-center';
import { formatDateTime } from '../../utils/formatters';

function formatFetchedAt(value: string | null): string {
  if (!value) return 'No API fetch this session';
  return formatDateTime(value);
}

export default function FetchingActivityPanel({
  activity,
  isRefreshing,
}: {
  activity: FetchActivitySnapshot;
  isRefreshing?: boolean;
}) {
  const recentEntries = activity.entries.slice(0, 6);

  return (
    <section className="cc-fetch-activity dashboard-panel p-5" aria-label="Fetching activity">
      <div className="cc-fetch-activity-head">
        <div>
          <p className="eyebrow">Fetching Activity</p>
          <h3 className="cc-panel-title mt-1">Google API fetch timestamps</h3>
          <p className="mt-1 text-xs text-secondary-theme">
            Live server-side API call times — not database sync metadata.
          </p>
        </div>
        {isRefreshing ? (
          <span className="cc-fetch-activity-badge" aria-live="polite">Fetching…</span>
        ) : null}
      </div>

      <div className="cc-fetch-activity-grid">
        <div className="cc-fetch-activity-card">
          <p className="cc-fetch-activity-label">Google Drive API</p>
          <p className="cc-fetch-activity-value">{formatFetchedAt(activity.driveLastFetchedAt)}</p>
        </div>
        <div className="cc-fetch-activity-card">
          <p className="cc-fetch-activity-label">Google Sheets API</p>
          <p className="cc-fetch-activity-value">{formatFetchedAt(activity.sheetsLastFetchedAt)}</p>
        </div>
      </div>

      {recentEntries.length > 0 ? (
        <ul className="cc-fetch-activity-log">
          {recentEntries.map((entry) => (
            <li key={`${entry.provider}-${entry.fetchedAt}-${entry.operation}`} className="cc-fetch-activity-log-row">
              <span className="cc-fetch-activity-log-provider">
                {entry.provider === 'GOOGLE_DRIVE' ? 'Drive' : 'Sheets'}
              </span>
              <span className="cc-fetch-activity-log-operation">
                {entry.operation}
                {entry.sourceCode ? ` · ${entry.sourceCode}` : ''}
              </span>
              <time className="cc-fetch-activity-log-time" dateTime={entry.fetchedAt}>
                {formatDateTime(entry.fetchedAt)}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cc-fetch-activity-empty text-sm text-secondary-theme">
          Run Sync &amp; Refresh to fetch data from Google Drive and Sheets.
        </p>
      )}
    </section>
  );
}
