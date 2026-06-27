import type { ExecutiveInsight, SnapshotBatch } from '../../types/command-center';
import { formatSnapshotLabel } from '../../utils/formatters';

export function HomepageControls({
  snapshots,
  selectedKey,
  onSelectSnapshot,
  onRefresh,
  isRefreshing,
}: {
  snapshots: SnapshotBatch[];
  selectedKey: string;
  onSelectSnapshot: (key: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="cc-home-controls">
      <div className="cc-control-group">
        <p className="cc-control-label">Snapshot</p>
        <select className="cc-select" value={selectedKey} onChange={(e) => onSelectSnapshot(e.target.value)}>
          {snapshots.map((snap) => (
            <option key={snap.snapshotKey} value={snap.snapshotKey}>
              {formatSnapshotLabel(snap.snapshotKey)}
            </option>
          ))}
        </select>
      </div>

      <div className="cc-control-group cc-control-actions">
        <button type="button" onClick={onRefresh} disabled={isRefreshing} className="piano-button px-4 py-3 text-sm font-semibold disabled:opacity-60">
          {isRefreshing ? 'Refreshing...' : 'Sync & Refresh'}
        </button>
      </div>
    </div>
  );
}

export function ExecutiveInsightsPanel({ insights }: { insights: ExecutiveInsight[] }) {
  return (
    <section className="cc-panel cc-insights-panel">
      <div className="cc-panel-head">
        <p className="eyebrow">Executive Insights</p>
        <h3 className="cc-panel-title">What changed and where to focus</h3>
      </div>
      <div className="cc-insights-list">
        {insights.slice(0, 6).map((insight) => (
          <div key={insight.id} className={`cc-insight cc-insight-${insight.severity}`}>
            <span className="cc-insight-dot" />
            <p>{insight.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
