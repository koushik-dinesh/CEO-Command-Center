-- This file documents the database creation SQL only.
-- The executable `npm run db:create` command uses DB_NAME from `.env`
-- and connects with the single configured DB_USER/DB_PASSWORD account.
CREATE DATABASE IF NOT EXISTS `ceo_command_center`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
