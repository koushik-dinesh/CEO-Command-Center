import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import KpiCard from '../components/kpi/KpiCard';
import { api } from '../services/api';
import type { DashboardResponse } from '../types';
import { formatDateTime } from '../utils/formatters';

type ToastState = {
  message: string;
  kind: 'success' | 'info';
};

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function loadDashboard() {
    const data = await api.dashboard();
    setDashboard(data);
    return data;
  }

  useEffect(() => {
    loadDashboard().catch((err) => setError(err instanceof Error ? err.message : 'Unable to load dashboard'));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setError(null);
    try {
      const ingestion = await api.runIngestion();
      await loadDashboard();
      setToast({
        message: ingestion.message,
        kind: ingestion.newDataFound ? 'success' : 'info',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <>
      {toast ? (
        <div className={`fixed right-6 top-6 z-50 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-2xl backdrop-blur ${toast.kind === 'success' ? 'toast-success' : 'toast-info'}`}>
          {toast.message}
        </div>
      ) : null}

      <div className="dashboard-panel mb-8 flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
        <div>
          <p className="eyebrow text-sm font-semibold uppercase tracking-[0.25em]">Strategic Monitoring</p>
          <h2 className="mt-2 text-xl font-semibold text-primary-theme">{dashboard?.dashboardName ?? 'Dashboard'}</h2>
          <p className="mt-1 text-sm text-secondary-theme">Last updated {formatDateTime(dashboard?.refreshedAt ?? null)}</p>
          <p className="mt-1 text-xs text-muted-theme">Data last changed {formatDateTime(dashboard?.dataLastUpdatedAt ?? null)}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/drive-explorer" className="piano-button-secondary px-4 py-3 text-sm font-semibold">
            Drive Explorer
          </Link>
          <button type="button" onClick={() => void handleRefresh()} disabled={isRefreshing} className="piano-button px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60">
            {isRefreshing ? 'Refreshing...' : 'Run data refresh'}
          </button>
        </div>
      </div>

      {error ? <p className="error-banner mb-6 rounded-xl px-4 py-3 text-sm">{error}</p> : null}

      {!dashboard ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.kpis.map((kpi) => (
              kpi.code === 'REVENUE' ? (
                <Link key={kpi.code} to="/revenue-drilldown" className="block rounded-2xl outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]">
                  <KpiCard kpi={kpi} />
                </Link>
              ) : <KpiCard key={kpi.code} kpi={kpi} />
            ))}
          </div>
          <section className="dashboard-panel mt-8 p-5">
            <h2 className="text-lg font-semibold text-primary-theme">Processing Status</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dashboard.processing.map((item) => (
                <div key={`${item.dataSourceName}-${item.startedAt}`} className="processing-card rounded-xl p-4 text-sm">
                  <p className="font-medium text-primary-theme">{item.dataSourceName}</p>
                  <p className="mt-1 text-secondary-theme">{item.status}</p>
                  <p className="mt-2 text-xs text-muted-theme">Accepted {item.recordsAccepted} of {item.recordsRead}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
