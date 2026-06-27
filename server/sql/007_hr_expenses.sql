CREATE TABLE IF NOT EXISTS hr_expenses (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  financialYear SMALLINT UNSIGNED NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  calendarYear SMALLINT UNSIGNED NOT NULL,
  hrExpense DECIMAL(20, 2) NOT NULL,
  updatedBy VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY hr_expenses_calendar_unique (calendarYear, month),
  KEY hr_expenses_financial_year_idx (financialYear, calendarYear, month),
  CONSTRAINT hr_expenses_updatedBy_fk FOREIGN KEY (updatedBy) REFERENCES users(id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
