import type { AuthUser, DashboardResponse, DriveExplorerResponse, IngestionRunResponse, ProcessingStatus, RevenueDrilldownResponse } from '../types';
import type { CommandCenterFilters, CommandCenterResponse, ComparisonResponse, SnapshotSyncStartResponse, SnapshotSyncStatusResponse } from '../types/command-center';
import type { HrExpenseListResponse, HrExpensePayload, HrExpenseRecord } from '../types/productivity';
import type { PbtCalculatedRecord, PbtCalculatedResponse, PbtHistoricalResponse, PbtHrExpenseResponse, PbtInputPayload, PbtRevenueResponse } from '../types/pbt';

/** Empty default: same-origin `/api/*` (reverse proxy in prod; Vite proxy in dev). Set full URL only when API is on another host. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(errorBody.message ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export const api = {
  login(email: string, password: string) {
    return request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },
  me() {
    return request<{ user: AuthUser | null }>('/api/auth/me');
  },
  dashboard() {
    return request<DashboardResponse>('/api/dashboard');
  },
  processingStatus() {
    return request<{ processing: ProcessingStatus[] }>('/api/processing/status');
  },
  runIngestion() {
    return request<IngestionRunResponse>('/api/ingestion/run', { method: 'POST' });
  },
  driveExplorerFiles() {
    return request<DriveExplorerResponse>('/api/drive-explorer/files');
  },
  revenueDrilldown() {
    return request<RevenueDrilldownResponse>('/api/revenue/drilldown');
  },
  commandCenterDashboard(snapshotKey?: string, filters: CommandCenterFilters = {}) {
    const params = new URLSearchParams();
    if (snapshotKey) params.set('snapshotKey', snapshotKey);
    if (filters.salesperson) params.set('salesperson', filters.salesperson);
    if (filters.customerGroup) params.set('customerGroup', filters.customerGroup);
    if (filters.productGroup) params.set('productGroup', filters.productGroup);
    if (filters.warehouse) params.set('warehouse', filters.warehouse);
    const query = params.toString();
    return request<CommandCenterResponse>(`/api/command-center/dashboard${query ? `?${query}` : ''}`);
  },
  commandCenterSyncStart() {
    return request<SnapshotSyncStartResponse>('/api/command-center/sync', { method: 'POST' });
  },
  commandCenterSyncStatus(runId: string) {
    return request<SnapshotSyncStatusResponse>(`/api/command-center/sync/${encodeURIComponent(runId)}`);
  },
  commandCenterCompare(current: string, previous: string) {
    const params = new URLSearchParams({ current, previous });
    return request<ComparisonResponse>(`/api/command-center/compare?${params.toString()}`);
  },
  pbtGetInput(year: number, month: number) {
    return request<PbtCalculatedRecord>(`/api/pbt/inputs/${year}/${month}`);
  },
  pbtListInputs() {
    return request<PbtHistoricalResponse>('/api/pbt/inputs');
  },
  pbtCalculated() {
    return request<PbtCalculatedResponse>('/api/pbt/calculated');
  },
  pbtRevenue(year: number, month: number) {
    return request<PbtRevenueResponse>(`/api/pbt/revenue/${year}/${month}`);
  },
  pbtHrExpense(year: number, month: number) {
    return request<PbtHrExpenseResponse>(`/api/pbt/hr-expense/${year}/${month}`);
  },
  pbtCreateInput(payload: PbtInputPayload) {
    return request<PbtCalculatedRecord>('/api/pbt/inputs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  pbtUpdateInput(year: number, month: number, payload: Pick<PbtInputPayload, 'directExpense' | 'additionalIndirectExpense'>) {
    return request<PbtCalculatedRecord>(`/api/pbt/inputs/${year}/${month}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  productivityListHrExpenses() {
    return request<HrExpenseListResponse>('/api/productivity/hr-expenses');
  },
  productivitySaveHrExpense(payload: HrExpensePayload) {
    return request<HrExpenseRecord>('/api/productivity/hr-expenses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  productivityDeleteHrExpense(year: number, month: number) {
    return request<{ ok: boolean }>(`/api/productivity/hr-expenses/${year}/${month}`, {
      method: 'DELETE',
    });
  },
};
