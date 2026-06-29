import { env } from '../config/env.js';
import type { SnapshotSyncResult } from '../reports/SnapshotEngine.js';
import { pruneAuditTables } from './auditRetentionService.js';
import {
  SyncSessionRepository,
  type SyncSessionFileStatus,
  type SyncSessionSource,
  type SyncSessionStatus,
  type SyncSessionType,
} from '../repositories/SyncSessionRepository.js';

export type SyncHistorySource = SyncSessionSource;
export type SyncHistorySyncType = SyncSessionType;
export type SyncHistorySessionStatus = SyncSessionStatus;

export type SyncHistoryFileStatus = 'success' | 'failed';

export interface SyncHistoryFile {
  name: string;
  status: SyncHistoryFileStatus;
  fetchedAt: string;
  error?: string;
}

export interface SyncHistorySession {
  id: string;
  source: SyncHistorySource;
  syncType: SyncHistorySyncType;
  status: SyncHistorySessionStatus;
  startedAt: string;
  completedAt: string;
  totalFilesProcessed: number;
  durationMs: number;
  files: SyncHistoryFile[];
}

export interface SyncHistorySnapshot {
  sessions: SyncHistorySession[];
}

const SOURCE_LABELS: Record<string, string> = {
  COPQ_DASHBOARD_SHEET: 'COPQ_DASHBOARD',
  HR_COST_SHEET: 'HR_COST',
};

function displayName(code: string): string {
  return SOURCE_LABELS[code] ?? code;
}

function isSuccessStatus(status: string): boolean {
  return status === 'SUCCESS' || status === 'PARTIAL';
}

function isFetchedSourceStatus(status: string): boolean {
  return status !== 'SKIPPED';
}

function toFileStatus(status: SyncHistoryFileStatus): SyncSessionFileStatus {
  return status === 'failed' ? 'FAILED' : 'SUCCESS';
}

function fromFileStatus(status: SyncSessionFileStatus): SyncHistoryFileStatus {
  return status === 'FAILED' ? 'failed' : 'success';
}

export function buildSyncSessionFiles(
  sourceResults: Array<{ sourceCode: string; status: string }>,
  snapshotResult: SnapshotSyncResult,
): SyncHistoryFile[] {
  const files = new Map<string, SyncHistoryFile>();

  for (const result of sourceResults) {
    if (!isFetchedSourceStatus(result.status)) continue;
    const name = displayName(result.sourceCode);
    files.set(name, {
      name,
      status: isSuccessStatus(result.status) ? 'success' : 'failed',
      fetchedAt: new Date().toISOString(),
    });
  }

  for (const item of snapshotResult.files) {
    files.set(item.name, {
      name: item.name,
      status: item.status,
      fetchedAt: new Date().toISOString(),
      error: item.error,
    });
  }

  return [...files.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function inferSyncSource(
  sourceResults: Array<{ sourceCode: string; status: string }>,
  snapshotResult: SnapshotSyncResult,
): SyncHistorySource {
  const fetchedSources = sourceResults.filter((result) => isFetchedSourceStatus(result.status));
  const hasSheetsSource = fetchedSources.some((result) =>
    result.sourceCode.includes('SHEET') || result.sourceCode === 'COPQ_DASHBOARD_SHEET',
  );
  if (hasSheetsSource && fetchedSources.length > 0 && snapshotResult.files.length === 0) {
    return 'SHEETS';
  }
  return 'DRIVE';
}

export function deriveSessionStatus(
  files: SyncHistoryFile[],
  options: { failed?: boolean } = {},
): SyncSessionStatus {
  if (options.failed) return 'FAILED';
  if (files.some((file) => file.status === 'failed')) return 'PARTIAL';
  return 'SUCCESS';
}

export function mapDiscoveryStatus(status: string): SyncSessionStatus {
  if (status === 'FAILED') return 'FAILED';
  if (status === 'PARTIAL') return 'PARTIAL';
  return 'SUCCESS';
}

export interface PersistSyncSessionInput {
  syncType: SyncSessionType;
  source?: SyncHistorySource;
  startedAt: Date;
  completedAt: Date;
  status?: SyncSessionStatus;
  errorMessage?: string | null;
  sourceResults?: Array<{ sourceCode: string; status: string }>;
  snapshotResult?: SnapshotSyncResult;
  files?: SyncHistoryFile[];
}

export async function persistSyncSession(input: PersistSyncSessionInput): Promise<string> {
  const sourceResults = input.sourceResults ?? [];
  const snapshotResult = input.snapshotResult ?? {
    scanned: 0,
    processed: 0,
    skipped: 0,
    errors: [],
    processedSnapshotDates: [],
    processedSnapshotKeys: [],
    files: [],
  };
  const files = input.files ?? buildSyncSessionFiles(sourceResults, snapshotResult);
  const source = input.source ?? inferSyncSource(sourceResults, snapshotResult);
  const status = input.status ?? deriveSessionStatus(files, { failed: input.errorMessage != null && files.length === 0 });
  const completedAt = input.completedAt;
  const fetchedAt = completedAt;

  const sessionId = await SyncSessionRepository.create({
    source,
    syncType: input.syncType,
    status,
    totalFilesProcessed: files.length,
    durationMs: Math.max(0, completedAt.getTime() - input.startedAt.getTime()),
    errorMessage: input.errorMessage ?? null,
    startedAt: input.startedAt,
    completedAt,
    files: files.map((file) => ({
      fileName: file.name,
      fetchedAt,
      status: toFileStatus(file.status),
      errorMessage: file.error ?? null,
    })),
  });

  void pruneSyncHistory();

  return sessionId;
}

export async function pruneSyncHistory(): Promise<void> {
  try {
    await pruneAuditTables();
  } catch (error) {
    console.warn('[sync-history] Audit retention prune failed', error);
  }
}

function getTimezoneDayBounds(timezone: string, reference = new Date()): { start: Date; end: Date } {
  const dateKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(reference);

  const offset = timezone === 'Asia/Kolkata' ? '+05:30' : 'Z';
  const start = new Date(`${dateKey}T00:00:00.000${offset}`);
  const end = new Date(`${dateKey}T23:59:59.999${offset}`);
  return { start, end };
}

export async function getTodaySyncHistory(timezone = env.DEFAULT_TIMEZONE): Promise<SyncHistorySnapshot> {
  const { start, end } = getTimezoneDayBounds(timezone);
  const sessions = await SyncSessionRepository.listBetween(start, end);
  if (sessions.length === 0) return { sessions: [] };

  const files = await SyncSessionRepository.listFilesForSessions(sessions.map((session) => session.id));
  const filesBySession = new Map<string, SyncHistoryFile[]>();

  for (const file of files) {
    const sessionFiles = filesBySession.get(file.syncSessionId) ?? [];
    sessionFiles.push({
      name: file.fileName,
      status: fromFileStatus(file.status),
      fetchedAt: file.fetchedAt.toISOString(),
      error: file.errorMessage ?? undefined,
    });
    filesBySession.set(file.syncSessionId, sessionFiles);
  }

  return {
    sessions: sessions.map((session) => ({
      id: session.id,
      source: session.source,
      syncType: session.syncType,
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt.toISOString(),
      totalFilesProcessed: session.totalFilesProcessed,
      durationMs: session.durationMs,
      files: filesBySession.get(session.id) ?? [],
    })),
  };
}
