-- Phase 6: Remove orphaned staging rows for sources migrated to the snapshot pipeline (Phase 3).
-- Safe after REVENUE_CSV / INVENTORY_CSV / SAP_EXPORT_CSV ingestion is disabled and KPI calculators prefer snapshots.

DELETE ssc
FROM staging_source_current ssc
WHERE ssc.dataSourceCode IN ('REVENUE_CSV', 'INVENTORY_CSV', 'SAP_EXPORT_CSV');

DELETE sr
FROM staging_records sr
INNER JOIN data_sources ds ON ds.id = sr.dataSourceId
WHERE ds.code IN ('REVENUE_CSV', 'INVENTORY_CSV', 'SAP_EXPORT_CSV');
