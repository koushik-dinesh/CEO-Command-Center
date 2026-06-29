-- Backfill copq_analytics_meta.headlineJson from latest COPQ staging normalized payload.

UPDATE copq_analytics_meta cam
INNER JOIN data_sources ds ON ds.id = cam.dataSourceId AND ds.code = 'COPQ_DASHBOARD_SHEET'
INNER JOIN (
  SELECT sr.dataSourceId, sr.normalized
  FROM staging_records sr
  INNER JOIN (
    SELECT dataSourceId, MAX(createdAt) AS maxCreatedAt
    FROM staging_records
    GROUP BY dataSourceId
  ) latest ON latest.dataSourceId = sr.dataSourceId AND latest.maxCreatedAt = sr.createdAt
) staging ON staging.dataSourceId = cam.dataSourceId
SET cam.headlineJson = JSON_OBJECT(
  'totalCopq', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.totalCopq')),
  'copqYtd', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.copqYtd')),
  'copqMtd', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.copqMtd')),
  'copqQtd', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.copqQtd')),
  'copqBeforeQaClearance', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.copqBeforeQaClearance')),
  'qaSavedAmount', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.qaSavedAmount')),
  'sourceWorkbookName', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.sourceWorkbookName')),
  'sourceSheetName', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.sourceSheetName')),
  'sourceCell', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.sourceCell')),
  'sourceCellFormula', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.sourceCellFormula')),
  'sourceCellValueType', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.sourceCellValueType')),
  'copqBeforeQaClearanceCell', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.copqBeforeQaClearanceCell')),
  'qaSavedAmountCell', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.qaSavedAmountCell')),
  'sourceLastUpdatedAt', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.sourceLastUpdatedAt')),
  'copqReferenceDate', JSON_UNQUOTE(JSON_EXTRACT(staging.normalized, '$.copqReferenceDate'))
)
WHERE cam.headlineJson IS NULL;
