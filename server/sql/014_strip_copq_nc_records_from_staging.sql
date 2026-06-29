-- Phase 5: nc_copq_facts is the canonical NC register; drop ncRecords blob from staging raw.

UPDATE staging_records sr
INNER JOIN data_sources ds ON ds.id = sr.dataSourceId
SET sr.raw = JSON_REMOVE(sr.raw, '$.ncRecords')
WHERE ds.code = 'COPQ_DASHBOARD_SHEET'
  AND JSON_CONTAINS_PATH(sr.raw, 'one', '$.ncRecords');
