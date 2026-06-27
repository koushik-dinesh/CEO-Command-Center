# Phase 1 Source Mapping

The seeded data source configurations use the following baseline columns. Update `server/scripts/seed.ts` or `data_sources.configJson` values if real company files use different names.

## Revenue CSV

- Source code: `REVENUE_CSV`
- Provider: Google Drive
- Required columns: `date`, `revenue`
- Optional columns: `invoiceNumber`, `cogs`
- Used by: Revenue, COGS, Revenue to HR Cost Ratio

## SAP Export CSV

- Source code: `SAP_EXPORT_CSV`
- Provider: Google Drive
- Required columns: `date`, `cogs`
- Optional columns: `revenue`, `documentNumber`
- Used by: COGS, Revenue, Inventory Turnover Ratio

## Inventory CSV

- Source code: `INVENTORY_CSV`
- Provider: Google Drive
- Required columns: `date`, `inventoryValue`
- Optional columns: `itemCode`, `quantity`, `unitCost`
- Used by: Inventory Value, Inventory Turnover Ratio

## NC Register CSV

- Source code: `NC_REGISTER_CSV`
- Provider: Google Drive
- Required columns: `date`, `copqCost`
- Optional columns: `ncNumber`, `category`, `description`
- Used by: COPQ

## HR Cost Sheet

- Source code: `HR_COST_SHEET`
- Provider: Google Sheets
- Required columns: `period`, `hrCost`
- Optional columns: `department`
- Used by: Revenue to HR Cost Ratio

## Sample Fixtures

Sample files are available in `server/fixtures/`. They are intentionally small and are used to document expected shape, not to represent real company data.
