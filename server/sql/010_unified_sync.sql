-- Unified sync: dedupe current KPI/staging rows and enforce upsert keys.

-- Keep the latest KPI row per definition + reporting period.
DELETE kv FROM kpi_values kv
INNER JOIN (
  SELECT kpiDefinitionId, periodEnd, MAX(calculatedAt) AS maxCalculatedAt
  FROM kpi_values
  GROUP BY kpiDefinitionId, periodEnd
  HAVING COUNT(*) > 1
) latest ON kv.kpiDefinitionId = latest.kpiDefinitionId
  AND kv.periodEnd = latest.periodEnd
  AND kv.calculatedAt < latest.maxCalculatedAt;

ALTER TABLE kpi_values
  ADD UNIQUE KEY kpi_values_definition_period_unique (kpiDefinitionId, periodEnd);

-- Keep the latest staging row per data source + source key.
DELETE sr FROM staging_records sr
INNER JOIN (
  SELECT dataSourceId, sourceKey, MAX(createdAt) AS maxCreatedAt
  FROM staging_records
  WHERE sourceKey IS NOT NULL
  GROUP BY dataSourceId, sourceKey
  HAVING COUNT(*) > 1
) latest ON sr.dataSourceId = latest.dataSourceId
  AND sr.sourceKey = latest.sourceKey
  AND sr.createdAt < latest.maxCreatedAt;

ALTER TABLE staging_records
  ADD UNIQUE KEY staging_records_source_key_unique (dataSourceId, sourceKey);
