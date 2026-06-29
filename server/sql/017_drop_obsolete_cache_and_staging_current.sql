-- Phase 8: remove dead storage (revenue drilldown cache, unused staging_source_current).

DROP TABLE IF EXISTS revenue_drilldown_cache;
DROP TABLE IF EXISTS staging_source_current;
