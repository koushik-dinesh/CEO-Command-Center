export function getCurrentReportingPeriod(now = new Date()) {
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { periodStart, periodEnd };
}
export function parseSourceDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
        return value;
    if (typeof value !== 'string' && typeof value !== 'number')
        return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}
