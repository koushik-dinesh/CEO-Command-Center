import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import type { CommandCenterFilters, CommandCenterResponse } from '../types/command-center';

export function useCommandCenter(initialFilters: CommandCenterFilters = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<CommandCenterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<CommandCenterFilters>(initialFilters);

  const snapshotKey = searchParams.get('snapshot') ?? undefined;
  const compareKey = searchParams.get('compare') ?? undefined;

  const load = useCallback(async (nextSnapshot?: string, nextFilters: CommandCenterFilters = filters) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.commandCenterDashboard(nextSnapshot ?? snapshotKey, nextFilters);
      setData(response);
      if (nextSnapshot && nextSnapshot !== snapshotKey) {
        setSearchParams((current) => {
          const params = new URLSearchParams(current);
          params.set('snapshot', nextSnapshot);
          return params;
        }, { replace: true });
      }
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load command center');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [filters, setSearchParams, snapshotKey]);

  useEffect(() => {
    void load();
  }, []);

  function selectSnapshot(key: string) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('snapshot', key);
      return params;
    }, { replace: true });
    void load(key);
  }

  function selectCompare(key: string | null) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (key) params.set('compare', key);
      else params.delete('compare');
      return params;
    }, { replace: true });
  }

  return {
    data,
    error,
    isLoading,
    filters,
    setFilters,
    snapshotKey,
    compareKey,
    load,
    selectSnapshot,
    selectCompare,
  };
}
