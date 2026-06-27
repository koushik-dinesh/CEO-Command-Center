CREATE TABLE IF NOT EXISTS snapshot_file_registry (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  providerFileId VARCHAR(191) NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  reportType VARCHAR(64) NOT NULL,
  snapshotKey VARCHAR(32) NOT NULL,
  snapshotDate DATE NOT NULL,
  driveMd5Checksum VARCHAR(64) NULL,
  contentChecksum VARCHAR(191) NOT NULL,
  status ENUM('PROCESSED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PROCESSED',
  processedAt DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY snapshot_file_registry_providerFileId_key (providerFileId),
  KEY snapshot_file_registry_snapshotKey_idx (snapshotKey),
  KEY snapshot_file_registry_snapshotDate_idx (snapshotDate),
  KEY snapshot_file_registry_reportType_idx (reportType),
  KEY snapshot_file_registry_contentChecksum_idx (contentChecksum)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS snapshot_sync_runs (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  runType ENUM('DISCOVERY', 'MAINTENANCE', 'MANUAL') NOT NULL,
  status ENUM('SUCCESS', 'PARTIAL', 'NO_NEW_FILES', 'FAILED') NOT NULL,
  scanned INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  newFilesDetected INT NOT NULL DEFAULT 0,
  todaySnapshotFound BOOLEAN NOT NULL DEFAULT FALSE,
  errorMessage TEXT NULL,
  metadataJson JSON NULL,
  startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finishedAt DATETIME(3) NULL,
  KEY snapshot_sync_runs_runType_startedAt_idx (runType, startedAt),
  KEY snapshot_sync_runs_startedAt_idx (startedAt)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT IGNORE INTO snapshot_file_registry
  (id, providerFileId, fileName, reportType, snapshotKey, snapshotDate, driveMd5Checksum, contentChecksum, status, processedAt)
SELECT
  id,
  providerFileId,
  fileName,
  reportType,
  snapshotKey,
  snapshotDate,
  NULL,
  checksum,
  'PROCESSED',
  processedAt
FROM report_snapshots;
