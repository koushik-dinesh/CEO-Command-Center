# CEO Command Center Phase 1 Business Rules

This document captures the implementation baseline for Phase 1. These rules should be reviewed with business stakeholders before production use.

## Reporting Period

- Default reporting period is the current calendar month in `Asia/Kolkata` timezone.
- KPI calculations include rows where the source date falls between the first and last day of the current month.
- Historical comparison uses the most recent previously calculated KPI value for the same KPI.

## Currency And Precision

- Monetary values are stored as MySQL `DECIMAL` values.
- Default currency is INR unless the source configuration states otherwise.
- Ratios are stored as decimal values and formatted in the frontend based on KPI display format.

## KPI Formulas

- Revenue: sum of accepted revenue amount rows for the reporting period.
- Inventory Value: total inventory value from the latest inventory snapshot in the reporting period.
- COGS: sum of accepted cost of goods sold rows for the reporting period.
- Inventory Turnover Ratio: COGS divided by average inventory value for the reporting period.
- COPQ: sum of accepted cost-of-poor-quality rows from the NC register for the reporting period.
- Revenue to HR Cost Ratio: revenue divided by HR cost for the reporting period.

## Trend Rules

- Trend compares the newly calculated KPI value with the previous persisted KPI snapshot.
- `UP` means the current value is greater than the previous value.
- `DOWN` means the current value is lower than the previous value.
- `FLAT` means the values are equal.
- `UNKNOWN` is used when no previous value exists.

## Source File Rules

- Each data source has one configured Google Drive folder or Google Sheets range.
- The ingestion layer processes only the latest matching file per Google Drive data source.
- Duplicate files are skipped using checksum and provider file ID checks.
- Google Sheets sources are treated as changed when their returned content hash changes.

## Data Quality Rules

- Rows missing required dates or numeric fields are rejected.
- Invalid numeric values are rejected instead of coerced to zero.
- Failed sources are logged without clearing the latest successful KPI values.
- Ratio KPIs become unavailable when the denominator is missing or zero.
