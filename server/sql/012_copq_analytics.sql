-- Phase 4: COPQ analytics storage — slim NC facts replace multi-MB raw JSON for reads.
-- staging_records.raw is still written during migration; facts are the canonical read path.

CREATE TABLE IF NOT EXISTS nc_copq_facts (
  dataSourceId VARCHAR(191) NOT NULL,
  sourceKey VARCHAR(191) NOT NULL,
  ncNumber VARCHAR(191) NOT NULL,
  ncDate DATE NOT NULL,
  displayDate VARCHAR(64) NOT NULL,
  product VARCHAR(191) NOT NULL,
  department VARCHAR(191) NOT NULL,
  rootCause VARCHAR(255) NOT NULL,
  category VARCHAR(191) NOT NULL,
  status VARCHAR(64) NOT NULL,
  finalCopq DECIMAL(20, 4) NOT NULL,
  beforeQaCopq DECIMAL(20, 4) NULL,
  syncedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (dataSourceId, sourceKey),
  KEY nc_copq_facts_ncDate_idx (ncDate),
  KEY nc_copq_facts_department_idx (department),
  KEY nc_copq_facts_category_idx (category),
  KEY nc_copq_facts_finalCopq_idx (finalCopq),
  CONSTRAINT nc_copq_facts_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS copq_analytics_meta (
  dataSourceId VARCHAR(191) NOT NULL PRIMARY KEY,
  referenceDate DATE NOT NULL,
  financialYearStart DATE NOT NULL,
  monthStart DATE NOT NULL,
  quarterStart DATE NOT NULL,
  sheetName VARCHAR(191) NULL,
  sourceWorkbook VARCHAR(255) NULL,
  lastUpdated VARCHAR(64) NULL,
  recordCount INT UNSIGNED NOT NULL DEFAULT 0,
  rejectedRowCount INT UNSIGNED NOT NULL DEFAULT 0,
  dateColumnUsed VARCHAR(191) NULL,
  copqColumnUsed VARCHAR(191) NULL,
  syncedAt DATETIME(3) NOT NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT copq_analytics_meta_dataSourceId_fk FOREIGN KEY (dataSourceId) REFERENCES data_sources(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
