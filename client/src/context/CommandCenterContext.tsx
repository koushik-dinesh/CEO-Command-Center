import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import type { CommandCenterResponse } from '../types/command-center';
import { traceCopqMetricFromResponse } from '../debug/o34PipelineTrace';

interface CommandCenterContextValue {
  data: CommandCenterResponse | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  snapshotKey: string | undefined;
  selectSnapshot: (key: string) => void;
  refresh: () => Promise<void>;
  reload: (snapshotKey?: string, options?: { silent?: boolean }) => Promise<CommandCenterResponse | undefined>;
}

const CommandCenterContext = createContext<CommandCenterContextValue | null>(null);

const SYNC_POLL_INTERVAL_MS = 400;
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;

async function waitForSyncCompletion(runId: string) {
  const deadline = Date.now() + SYNC_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await api.commandCenterSyncStatus(runId);
    if (!status.running) {
      if (status.status === 'FAILED') {
        throw new Error(status.errorMessage ?? 'Snapshot sync failed');
      }
      return status;
    }
    await new Promise((resolve) => window.setTimeout(resolve, SYNC_POLL_INTERVAL_MS));
  }
  throw new Error('Snapshot sync timed out. Please try again.');
}

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<CommandCenterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const snapshotKey = searchParams.get('snapshot') ?? undefined;

  const reload = useCallback(async (nextSnapshot?: string, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await api.commandCenterDashboard(nextSnapshot ?? snapshotKey);
      traceCopqMetricFromResponse(response.kpis);
      console.log('API O34', {
        copqKpi: response.kpis.find((kpi) => kpi.key === 'copq') ?? null,
        copqSourceDebugKeys: response.copqSourceDebug ? Object.keys(response.copqSourceDebug) : [],
      });
      setData(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load command center');
      return undefined;
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [snapshotKey]);

  useEffect(() => {
    void reload(snapshotKey);
  }, [snapshotKey]);

  const selectSnapshot = useCallback((key: string) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('snapshot', key);
      params.delete('compare');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const { runId } = await api.commandCenterSyncStart();
      await waitForSyncCompletion(runId);
      await reload(snapshotKey, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to refresh data');
      throw err;
    } finally {
      setIsRefreshing(false);
    }
  }, [reload, snapshotKey]);

  const value = useMemo(() => ({
    data,
    error,
    isLoading,
    isRefreshing,
    snapshotKey: data?.snapshotKey ?? snapshotKey,
    selectSnapshot,
    refresh,
    reload,
  }), [data, error, isLoading, isRefreshing, snapshotKey, selectSnapshot, refresh, reload]);

  return <CommandCenterContext.Provider value={value}>{children}</CommandCenterContext.Provider>;
}

export function useCommandCenterContext() {
  const context = useContext(CommandCenterContext);
  if (!context) throw new Error('useCommandCenterContext must be used within CommandCenterProvider');
  return context;
}
