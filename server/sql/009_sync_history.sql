CREATE TABLE IF NOT EXISTS sync_sessions (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  source ENUM('DRIVE', 'SHEETS') NOT NULL DEFAULT 'DRIVE',
  syncType ENUM('MANUAL', 'AUTOMATIC') NOT NULL,
  status ENUM('SUCCESS', 'PARTIAL', 'FAILED') NOT NULL,
  totalFilesProcessed INT NOT NULL DEFAULT 0,
  durationMs INT NOT NULL DEFAULT 0,
  errorMessage TEXT NULL,
  startedAt DATETIME(3) NOT NULL,
  completedAt DATETIME(3) NOT NULL,
  KEY sync_sessions_completedAt_idx (completedAt),
  KEY sync_sessions_syncType_completedAt_idx (syncType, completedAt)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sync_session_files (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  syncSessionId VARCHAR(191) NOT NULL,
  fileName VARCHAR(191) NOT NULL,
  fetchedAt DATETIME(3) NOT NULL,
  status ENUM('SUCCESS', 'FAILED') NOT NULL,
  errorMessage TEXT NULL,
  KEY sync_session_files_syncSessionId_idx (syncSessionId),
  KEY sync_session_files_syncSessionId_fileName_idx (syncSessionId, fileName),
  CONSTRAINT sync_session_files_syncSessionId_fk
    FOREIGN KEY (syncSessionId) REFERENCES sync_sessions(id) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
