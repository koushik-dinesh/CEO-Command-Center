export type FetchProvider = 'GOOGLE_DRIVE' | 'GOOGLE_SHEETS';

export interface FetchActivityEntry {
  provider: FetchProvider;
  operation: string;
  sourceCode?: string;
  fetchedAt: string;
}

export interface FetchActivitySnapshot {
  driveLastFetchedAt: string | null;
  sheetsLastFetchedAt: string | null;
  entries: FetchActivityEntry[];
}

const MAX_ENTRIES = 40;

const state: {
  driveLastFetchedAt: string | null;
  sheetsLastFetchedAt: string | null;
  entries: FetchActivityEntry[];
} = {
  driveLastFetchedAt: null,
  sheetsLastFetchedAt: null,
  entries: [],
};

export function recordGoogleDriveFetch(operation: string, sourceCode?: string): void {
  const fetchedAt = new Date().toISOString();
  state.driveLastFetchedAt = fetchedAt;
  state.entries.unshift({ provider: 'GOOGLE_DRIVE', operation, sourceCode, fetchedAt });
  if (state.entries.length > MAX_ENTRIES) state.entries.length = MAX_ENTRIES;
}

export function recordGoogleSheetsFetch(operation: string, sourceCode?: string): void {
  const fetchedAt = new Date().toISOString();
  state.sheetsLastFetchedAt = fetchedAt;
  state.entries.unshift({ provider: 'GOOGLE_SHEETS', operation, sourceCode, fetchedAt });
  if (state.entries.length > MAX_ENTRIES) state.entries.length = MAX_ENTRIES;
}

export function getFetchActivitySnapshot(): FetchActivitySnapshot {
  return {
    driveLastFetchedAt: state.driveLastFetchedAt,
    sheetsLastFetchedAt: state.sheetsLastFetchedAt,
    entries: [...state.entries],
  };
}
