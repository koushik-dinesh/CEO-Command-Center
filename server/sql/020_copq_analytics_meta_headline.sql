-- Phase 11: persist COPQ dashboard headline cells without staging raw JSON reads.

ALTER TABLE copq_analytics_meta
  ADD COLUMN headlineJson JSON NULL AFTER copqColumnUsed;
