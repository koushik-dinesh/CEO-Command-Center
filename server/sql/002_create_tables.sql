CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  passwordHash VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  lastLoginAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS data_sources (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  code VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  sourceType ENUM('CSV', 'GOOGLE_SHEET') NOT NULL,
  provider ENUM('GOOGLE_DRIVE', 'GOOGLE_SHEETS', 'MANUAL') NOT NULL,
  locationRef VARCHAR(191) NOT NULL,
  configJson JSON NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  lastCheckedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uploaded_files (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  dataSourceId VARCHAR(191) NOT NULL,
  providerFileId VARCHAR(191) NOT NULL,
  fileName VARCHAR(191) NOT NULL,
  mimeType VARCHAR(191) NULL,
  checksum VARCHAR(191) NOT NULL,
  modifiedTime DATETIME(3) NULL,
  sizeBytes BIGINT NULL,
  status ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED', 'PARTIAL') NOT NULL DEFAULT 'PENDING',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uploaded_files_dataSourceId_providerFileId_key (dataSourceId, providerFileId),
  UNIQUE KEY uploaded_files_dataSourceId_checksum_key (dataSourceId, checksum),
  KEY uploaded_files_dataSourceId_createdAt_idx (dataSourceId, createdAt),
  CONSTRAINT uploaded_files_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS processing_logs (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  dataSourceId VARCHAR(191) NOT NULL,
  uploadedFileId VARCHAR(191) NULL,
  runType VARCHAR(191) NOT NULL,
  status ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED', 'PARTIAL') NOT NULL,
  startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  finishedAt DATETIME(3) NULL,
  recordsRead INT NOT NULL DEFAULT 0,
  recordsAccepted INT NOT NULL DEFAULT 0,
  recordsRejected INT NOT NULL DEFAULT 0,
  errorMessage TEXT NULL,
  metadataJson JSON NULL,
  KEY processing_logs_dataSourceId_startedAt_idx (dataSourceId, startedAt),
  KEY processing_logs_status_startedAt_idx (status, startedAt),
  CONSTRAINT processing_logs_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id),
  CONSTRAINT processing_logs_uploadedFileId_fk FOREIGN KEY (uploadedFileId) REFERENCES uploaded_files(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  code VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(191) NOT NULL,
  displayFormat VARCHAR(191) NOT NULL,
  calculationType VARCHAR(191) NOT NULL,
  sortOrder INT NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  configJson JSON NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY kpi_definitions_isActive_sortOrder_idx (isActive, sortOrder)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kpi_values (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  kpiDefinitionId VARCHAR(191) NOT NULL,
  periodStart DATETIME(3) NOT NULL,
  periodEnd DATETIME(3) NOT NULL,
  valueDecimal DECIMAL(20, 4) NULL,
  previousValueDecimal DECIMAL(20, 4) NULL,
  changePercent DECIMAL(12, 4) NULL,
  trendDirection ENUM('UP', 'DOWN', 'FLAT', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  status ENUM('CURRENT', 'STALE', 'PARTIAL', 'UNAVAILABLE') NOT NULL DEFAULT 'CURRENT',
  sourceRunId VARCHAR(191) NULL,
  metadataJson JSON NULL,
  calculatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY kpi_values_kpiDefinitionId_periodEnd_calculatedAt_idx (kpiDefinitionId, periodEnd, calculatedAt),
  CONSTRAINT kpi_values_kpiDefinitionId_fk FOREIGN KEY (kpiDefinitionId) REFERENCES kpi_definitions(id),
  CONSTRAINT kpi_values_sourceRunId_fk FOREIGN KEY (sourceRunId) REFERENCES processing_logs(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dashboard_configurations (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  isDefault BOOLEAN NOT NULL DEFAULT FALSE,
  layoutJson JSON NOT NULL,
  refreshIntervalSeconds INT NOT NULL DEFAULT 900,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY dashboard_configurations_isDefault_idx (isDefault)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS staging_records (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  dataSourceId VARCHAR(191) NOT NULL,
  sourceDate DATETIME(3) NOT NULL,
  sourceKey VARCHAR(191) NULL,
  normalized JSON NOT NULL,
  raw JSON NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY staging_records_dataSourceId_sourceDate_idx (dataSourceId, sourceDate),
  KEY staging_records_sourceDate_idx (sourceDate),
  CONSTRAINT staging_records_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS kpi_dependencies (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  kpiDefinitionId VARCHAR(191) NOT NULL,
  dataSourceId VARCHAR(191) NOT NULL,
  isRequired BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY kpi_dependencies_kpiDefinitionId_dataSourceId_key (kpiDefinitionId, dataSourceId),
  CONSTRAINT kpi_dependencies_kpiDefinitionId_fk FOREIGN KEY (kpiDefinitionId) REFERENCES kpi_definitions(id),
  CONSTRAINT kpi_dependencies_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_snapshots (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  reportType VARCHAR(64) NOT NULL,
  snapshotKey VARCHAR(32) NOT NULL,
  snapshotDate DATE NOT NULL,
  snapshotTimestamp DATETIME(3) NOT NULL,
  providerFileId VARCHAR(191) NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  checksum VARCHAR(191) NOT NULL,
  payloadJson JSON NOT NULL,
  processedAt DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY report_snapshots_providerFileId_key (providerFileId),
  UNIQUE KEY report_snapshots_reportType_checksum_key (reportType, checksum),
  KEY report_snapshots_snapshotKey_idx (snapshotKey),
  KEY report_snapshots_snapshotDate_idx (snapshotDate),
  KEY report_snapshots_reportType_timestamp_idx (reportType, snapshotTimestamp)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS revenue_drilldown_cache (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  providerFileId VARCHAR(191) NOT NULL UNIQUE,
  fileName VARCHAR(191) NOT NULL,
  mimeType VARCHAR(191) NULL,
  modifiedTime DATETIME(3) NULL,
  sizeBytes BIGINT NULL,
  fileDate VARCHAR(10) NOT NULL,
  fileTimestamp VARCHAR(32) NOT NULL,
  checksum VARCHAR(191) NOT NULL,
  payloadJson JSON NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY revenue_drilldown_cache_fileTimestamp_idx (fileTimestamp),
  KEY revenue_drilldown_cache_updatedAt_idx (updatedAt)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
