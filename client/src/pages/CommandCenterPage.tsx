import { useEffect, useState } from 'react';
import HeroKpiGrid from '../components/command-center/HeroKpiGrid';
import ExecutiveTrendArea from '../components/command-center/ExecutiveTrendArea';
import { HomepageControls, ExecutiveInsightsPanel } from '../components/command-center/Controls';
import { useCommandCenterContext } from '../context/CommandCenterContext';
import { logCopqSourceDebug } from '../debug/copqSourceDebug';

type ToastState = { message: string; kind: 'success' | 'info' };

export default function CommandCenterPage() {
  const { data, error, isLoading, selectSnapshot, refresh, isRefreshing } = useCommandCenterContext();
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (data) logCopqSourceDebug(data);
  }, [data]);

  async function handleRefresh() {
    try {
      await refresh();
      setToast({ message: 'Synced from Google Drive and refreshed dashboard.', kind: 'success' });
    } catch {
      setToast({ message: 'Refresh failed.', kind: 'info' });
    }
  }

  return (
    <>
      {toast ? (
        <div className={`fixed right-6 top-24 z-50 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-2xl backdrop-blur ${toast.kind === 'success' ? 'toast-success' : 'toast-info'}`}>
          {toast.message}
        </div>
      ) : null}

      <section className="cc-hero dashboard-panel mb-6 p-5 md:p-6">
        <div>
          <p className="eyebrow">Executive Command Center</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-primary-theme">Business Health at a Glance</h2>
        </div>
        {data ? (
          <div className="mt-5">
            <HomepageControls
              snapshots={data.availableSnapshots}
              selectedKey={data.snapshotKey}
              onSelectSnapshot={selectSnapshot}
              onRefresh={() => void handleRefresh()}
              isRefreshing={isRefreshing}
            />
          </div>
        ) : null}
      </section>

      {error ? <p className="error-banner mb-6 rounded-xl px-4 py-3 text-sm">{error}</p> : null}

      {isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-6">
          <HeroKpiGrid kpis={data.kpis} snapshotKey={data.snapshotKey} />
          <ExecutiveInsightsPanel insights={data.insights} />
          <ExecutiveTrendArea data={data} />
        </div>
      ) : null}
    </>
  );
}
