-- Widen nc_copq_facts.rootCause after backfill ER_DATA_TOO_LONG.
-- Analysis (2026-06-29): max observed rootCause = 301 chars; schema was VARCHAR(255).
-- All other VARCHAR columns in nc_copq_facts fit within their existing limits.

ALTER TABLE nc_copq_facts
  MODIFY COLUMN rootCause VARCHAR(512) NOT NULL;
