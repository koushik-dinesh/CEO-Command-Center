-- Phase 2: Analytics-oriented storage layers (additive; existing tables unchanged).
--
-- Layer 1 — CURRENT STATE (UPSERT): latest business values, no raw blobs.
-- Layer 2 — HISTORICAL ANALYTICS (append / daily UPSERT): trends and daily snapshots.
-- Layer 3 — AUDIT (INSERT + retention): processing_logs, sync_sessions, snapshot_sync_runs (existing).

-- ---------------------------------------------------------------------------
-- Layer 1: Current state — headline KPIs (mirrors kpi_values, 1 row per KPI)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_current (
  kpiDefinitionId VARCHAR(191) NOT NULL PRIMARY KEY,
  kpiCode VARCHAR(64) NOT NULL,
  periodStart DATETIME(3) NOT NULL,
  periodEnd DATETIME(3) NOT NULL,
  valueDecimal DECIMAL(20, 4) NULL,
  previousValueDecimal DECIMAL(20, 4) NULL,
  changePercent DECIMAL(12, 4) NULL,
  trendDirection ENUM('UP', 'DOWN', 'FLAT', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  status ENUM('CURRENT', 'STALE', 'PARTIAL', 'UNAVAILABLE') NOT NULL DEFAULT 'CURRENT',
  sourceRunId VARCHAR(191) NULL,
  metadataJson JSON NULL,
  calculatedAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY kpi_current_kpiCode_unique (kpiCode),
  KEY kpi_current_calculatedAt_idx (calculatedAt),
  CONSTRAINT kpi_current_kpiDefinitionId_fk FOREIGN KEY (kpiDefinitionId) REFERENCES kpi_definitions(id),
  CONSTRAINT kpi_current_sourceRunId_fk FOREIGN KEY (sourceRunId) REFERENCES processing_logs(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Layer 1: Current state — staging summaries without raw JSON (mirrors staging_records)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging_source_current (
  dataSourceId VARCHAR(191) NOT NULL,
  sourceKey VARCHAR(191) NOT NULL,
  dataSourceCode VARCHAR(64) NOT NULL,
  sourceDate DATETIME(3) NOT NULL,
  normalized JSON NOT NULL,
  summaryJson JSON NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (dataSourceId, sourceKey),
  KEY staging_source_current_dataSourceCode_idx (dataSourceCode),
  KEY staging_source_current_sourceDate_idx (sourceDate),
  CONSTRAINT staging_source_current_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Layer 2: Historical analytics — append-only KPI recalculation history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kpi_value_history (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  kpiDefinitionId VARCHAR(191) NOT NULL,
  kpiCode VARCHAR(64) NOT NULL,
  periodStart DATETIME(3) NOT NULL,
  periodEnd DATETIME(3) NOT NULL,
  valueDecimal DECIMAL(20, 4) NULL,
  previousValueDecimal DECIMAL(20, 4) NULL,
  changePercent DECIMAL(12, 4) NULL,
  trendDirection ENUM('UP', 'DOWN', 'FLAT', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  status ENUM('CURRENT', 'STALE', 'PARTIAL', 'UNAVAILABLE') NOT NULL DEFAULT 'CURRENT',
  sourceRunId VARCHAR(191) NULL,
  metadataJson JSON NULL,
  calculatedAt DATETIME(3) NOT NULL,
  recordedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY kpi_value_history_kpiCode_calculatedAt_idx (kpiCode, calculatedAt),
  KEY kpi_value_history_kpiDefinitionId_periodEnd_idx (kpiDefinitionId, periodEnd, calculatedAt),
  CONSTRAINT kpi_value_history_kpiDefinitionId_fk FOREIGN KEY (kpiDefinitionId) REFERENCES kpi_definitions(id),
  CONSTRAINT kpi_value_history_sourceRunId_fk FOREIGN KEY (sourceRunId) REFERENCES processing_logs(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Layer 2: Historical analytics — latest complete Drive snapshot per calendar day
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_daily_snapshots (
  snapshotDate DATE NOT NULL PRIMARY KEY,
  snapshotKey VARCHAR(32) NOT NULL,
  snapshotTimestamp DATETIME(3) NOT NULL,
  revenue DECIMAL(20, 4) NULL,
  grossProfit DECIMAL(20, 4) NULL,
  grossMargin DECIMAL(10, 4) NULL,
  ytdCogs DECIMAL(20, 4) NULL,
  daysElapsed SMALLINT UNSIGNED NULL,
  inventoryDays DECIMAL(12, 4) NULL,
  itr DECIMAL(12, 4) NULL,
  inventoryValue DECIMAL(20, 4) NULL,
  deadStock DECIMAL(20, 4) NULL,
  slowMovingStock DECIMAL(20, 4) NULL,
  reportCount TINYINT UNSIGNED NOT NULL DEFAULT 0,
  completeness DECIMAL(5, 4) NOT NULL DEFAULT 0,
  fileNames JSON NULL,
  syncedAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY analytics_daily_snapshots_snapshotKey_idx (snapshotKey),
  KEY analytics_daily_snapshots_snapshotTimestamp_idx (snapshotTimestamp)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
