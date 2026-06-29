function asRecord(value) {
    return value && typeof value === 'object' ? value : {};
}
export function extractNcRecordsFromCopqRaw(raw) {
    const record = asRecord(raw);
    const ncRecords = record.ncRecords;
    if (!ncRecords || typeof ncRecords !== 'object')
        return null;
    const payload = ncRecords;
    if (!Array.isArray(payload.values) || payload.values.length === 0)
        return null;
    return payload;
}
/** Remove the multi-MB NC register blob before persisting COPQ staging raw. */
export function stripNcRecordsFromCopqRaw(raw) {
    const record = asRecord(raw);
    if (!('ncRecords' in record))
        return raw;
    const { ncRecords: _removed, ...rest } = record;
    return rest;
}
