CREATE TABLE IF NOT EXISTS pbt_monthly_inputs (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  month TINYINT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  directExpense DECIMAL(20, 4) NOT NULL,
  indirectExpense DECIMAL(20, 4) NOT NULL,
  createdBy VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY pbt_monthly_inputs_year_month_unique (year, month),
  KEY pbt_monthly_inputs_year_month_idx (year, month),
  CONSTRAINT pbt_monthly_inputs_createdBy_fk FOREIGN KEY (createdBy) REFERENCES users(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
