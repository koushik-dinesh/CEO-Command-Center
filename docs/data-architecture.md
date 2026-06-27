# Data Architecture — Database-First Dashboard

## Executive Summary

Google Drive is now used **only during sync/ingestion**. All Command Center dashboard requests, snapshot switching, comparisons, and revenue drilldowns read exclusively from MySQL. KPI: `snapshot_metrics` table stores precomputed KPIs at sync time so dashboard loads avoid JSON reparsing and KPI recalculation.

---

## Previous Data Flow (Before Refactor)

```
Google Drive
  ↓ (sync only — correct)
SnapshotEngine → parse CSV → report_snapshots (JSON payloads)

Dashboard request
  ↓
CommandCenterService
  ↓
report_snapshots (MySQL) — already DB-backed
  ↓
extractCoreMetrics() + buildHistories() on EVERY request
  ↓ (4× history queries, JSON parse up to 480 payloads)
React UI

Revenue drilldown GET
  ↓
RevenueService.drilldown()
  ↓ (if cache empty)
Google Drive API — download + reparse CSV  ← PROBLEM

Post-sync
  ↓
SnapshotDiscoveryService → refreshCacheFromDrive()  ← PROBLEM
IngestionService → refreshCacheFromDrive()          ← PROBLEM
```

### Where Google Drive Was Accessed During Dashboard Usage

| Location | Trigger | Issue |
|----------|---------|-------|
| `RevenueService.drilldown()` | `GET /api/revenue/drilldown` when cache empty | Drive list + download + CSV parse |
| `RevenueService.refreshCacheFromDrive()` | Called after sync from discovery/ingestion | Correct timing but duplicated Drive work |

**Command Center dashboard** (`CommandCenterService`) was already MySQL-only for payloads, but **recalculated all KPIs and trend histories on every request** by parsing stored JSON from up to 120 snapshots × 4 report types.

---

## Target Architecture (Implemented)

```
Google Drive
  ↓
Scheduled Sync / Manual Sync (SnapshotEngine.syncFromDrive)
  ↓
File Discovery + Registry Check (snapshot_file_registry)
  ↓
CSV Parsing (once per new/changed file)
  ↓
MySQL Storage (report_snapshots.payloadJson)
  ↓
Precomputed Snapshot Metrics (snapshot_metrics) ← NEW
  ↓
Revenue Drilldown Cache (revenue_drilldown_cache) ← populated from DB at sync
  ↓
Dashboard APIs (MySQL reads only)
  ↓
React UI
```

### Snapshot Storage Model

Each synchronized file set is keyed by `snapshotKey` (e.g. `20260618_071700`):

| Layer | Table | Contents |
|-------|-------|----------|
| Parsed reports | `report_snapshots` | One row per report type per snapshot; structured `payloadJson` |
| Precomputed KPIs | `snapshot_metrics` | revenue, grossProfit, grossMargin, inventoryValue, deadStock, slowMovingStock |
| File tracking | `snapshot_file_registry` | Drive file IDs, checksums, skip unchanged files |
| Sync audit | `snapshot_sync_runs` | Run history, counts, errors |
| Revenue drilldown | `revenue_drilldown_cache` | Legacy-compatible cache built from `REVENUE_BY_SALESPERSON` snapshot row |

Example `snapshot_metrics` row:

| snapshotKey | revenue | grossProfit | grossMargin | inventoryValue | deadStock | slowMovingStock |
|-------------|---------|-------------|-------------|----------------|-----------|-----------------|
| 20260618_071700 | 12500000 | 4800000 | 38.4 | 8200000 | 450000 | 920000 |

---

## Schema Changes

### New: `snapshot_metrics` (`server/sql/004_snapshot_metrics.sql`)

```sql
CREATE TABLE snapshot_metrics (
  snapshotKey VARCHAR(32) PRIMARY KEY,
  snapshotDate DATE NOT NULL,
  snapshotTimestamp DATETIME(3) NOT NULL,
  revenue, grossProfit, grossMargin, inventoryValue, deadStock, slowMovingStock DECIMAL,
  reportCount TINYINT,
  completeness DECIMAL(5,4),
  fileNames JSON,
  computedAt DATETIME(3)
);
```

Backfill: `npm run db:backfill-metrics` (also runs as part of `db:schema`).

---

## Files Modified

| File | Change |
|------|--------|
| `server/sql/004_snapshot_metrics.sql` | New metrics table |
| `server/scripts/backfillSnapshotMetrics.ts` | Backfill existing snapshots |
| `server/src/repositories/SnapshotMetricsRepository.ts` | Metrics CRUD + history |
| `server/src/snapshots/SnapshotMetricsService.ts` | Compute + upsert at sync; backfill |
| `server/src/reports/SnapshotEngine.ts` | Precompute metrics after file processing |
| `server/src/command-center/CommandCenterService.ts` | Read KPIs/histories from `snapshot_metrics` |
| `server/src/revenue/revenue-service.ts` | DB-only drilldown; no Drive client |
| `server/src/revenue/revenue-drilldown-builder.ts` | Build drilldown from stored salesperson payload |
| `server/src/snapshots/SnapshotDiscoveryService.ts` | Remove post-sync Drive refresh |
| `server/src/ingestion/IngestionService.ts` | Remove post-ingestion Drive refresh |
| `server/src/routes/revenue.ts` | Optional `?snapshotKey=` query param |
| `server/package.json` | Migration + backfill scripts |

**Unchanged (intentionally Drive-backed):**

- `DriveExplorerService` — admin file browser
- `IngestionService` legacy KPI pipeline — separate `/legacy-dashboard` path
- `SnapshotEngine.syncFromDrive()` — sole Drive entry point for Command Center data

---

## Migration Strategy

1. Run `npm run db:schema` (applies 004 + backfills metrics from existing `report_snapshots`).
2. Deploy server — dashboard works immediately from backfilled metrics.
3. Next sync automatically refreshes metrics for changed snapshots.
4. If metrics missing for a key, `CommandCenterService` falls back to computing from stored JSON (backward compatible).

Rollback: drop `snapshot_metrics` table; dashboard reverts to JSON-based KPI computation (still no Drive on GET except revenue drilldown if old code restored).

---

## Performance Improvements (Estimated)

| Operation | Before | After |
|-----------|--------|-------|
| Dashboard KPI load | Parse 6 JSON payloads + compute metrics | 1–2 indexed rows from `snapshot_metrics` |
| Trend histories | 4 queries × 120 rows × JSON parse (~480 parses) | 1 query × 120 rows (numeric columns) |
| Snapshot switch | Same full recompute | Same DB reads; metrics are O(1) lookup |
| Revenue drilldown | Drive API if cache miss (2–5s) | MySQL read from snapshot or cache (<50ms) |
| Post-sync | Drive re-download for drilldown | Metrics + drilldown cache from already-parsed data |

Expected dashboard API latency reduction: **60–80%** for environments with many historical snapshots.

---

## API Behavior

| Endpoint | Data Source |
|----------|-------------|
| `GET /api/command-center/dashboard?snapshotKey=` | `report_snapshots` + `snapshot_metrics` |
| `GET /api/command-center/compare` | `snapshot_metrics` (fallback: payloads) |
| `POST /api/command-center/sync` | Google Drive → MySQL → metrics |
| `GET /api/revenue/drilldown?snapshotKey=` | `report_snapshots` / `revenue_drilldown_cache` |
| `GET /api/drive-explorer/*` | Google Drive (admin only) |

Snapshot switching is now **nearly instant**: all required structured data and precomputed KPIs exist in MySQL before the user selects a snapshot.
