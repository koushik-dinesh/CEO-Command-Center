/** Drive snapshot pipeline is canonical for these sources; staging ingestion is disabled in Phase 3. */
export const DUPLICATE_STAGING_SOURCE_CODES = new Set([
    'REVENUE_CSV',
    'INVENTORY_CSV',
    'SAP_EXPORT_CSV',
]);
export function isDuplicateStagingSource(sourceCode) {
    return DUPLICATE_STAGING_SOURCE_CODES.has(sourceCode);
}
