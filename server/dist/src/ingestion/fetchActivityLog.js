const MAX_ENTRIES = 40;
const state = {
    driveLastFetchedAt: null,
    sheetsLastFetchedAt: null,
    entries: [],
};
export function recordGoogleDriveFetch(operation, sourceCode) {
    const fetchedAt = new Date().toISOString();
    state.driveLastFetchedAt = fetchedAt;
    state.entries.unshift({ provider: 'GOOGLE_DRIVE', operation, sourceCode, fetchedAt });
    if (state.entries.length > MAX_ENTRIES)
        state.entries.length = MAX_ENTRIES;
}
export function recordGoogleSheetsFetch(operation, sourceCode) {
    const fetchedAt = new Date().toISOString();
    state.sheetsLastFetchedAt = fetchedAt;
    state.entries.unshift({ provider: 'GOOGLE_SHEETS', operation, sourceCode, fetchedAt });
    if (state.entries.length > MAX_ENTRIES)
        state.entries.length = MAX_ENTRIES;
}
export function getFetchActivitySnapshot() {
    return {
        driveLastFetchedAt: state.driveLastFetchedAt,
        sheetsLastFetchedAt: state.sheetsLastFetchedAt,
        entries: [...state.entries],
    };
}
