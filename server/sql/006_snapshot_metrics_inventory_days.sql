-- Idempotent column adds for inventory-days metrics (safe to re-run).
SET @dbname = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'snapshot_metrics' AND COLUMN_NAME = 'ytdCogs') > 0,
  'SELECT 1',
  'ALTER TABLE snapshot_metrics ADD COLUMN ytdCogs DECIMAL(20, 4) NULL AFTER grossMargin'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'snapshot_metrics' AND COLUMN_NAME = 'daysElapsed') > 0,
  'SELECT 1',
  'ALTER TABLE snapshot_metrics ADD COLUMN daysElapsed SMALLINT UNSIGNED NULL AFTER ytdCogs'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'snapshot_metrics' AND COLUMN_NAME = 'inventoryDays') > 0,
  'SELECT 1',
  'ALTER TABLE snapshot_metrics ADD COLUMN inventoryDays DECIMAL(12, 4) NULL AFTER daysElapsed'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = 'snapshot_metrics' AND COLUMN_NAME = 'itr') > 0,
  'SELECT 1',
  'ALTER TABLE snapshot_metrics ADD COLUMN itr DECIMAL(12, 4) NULL AFTER inventoryDays'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
