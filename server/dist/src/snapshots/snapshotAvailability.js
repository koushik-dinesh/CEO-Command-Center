import { formatISODateInTimezone, getTimezone } from './timezone.js';
export function buildSnapshotAvailability(latestSnapshotDate, now = new Date(), timeZone = getTimezone()) {
    const expectedDate = formatISODateInTimezone(now, timeZone);
    return {
        status: 'current',
        message: null,
        expectedDate,
        latestSnapshotDate,
    };
}
