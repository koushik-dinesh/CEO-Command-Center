import { formatISODateInTimezone, getTimezone } from './timezone.js';

export type SnapshotAvailabilityStatus = 'current' | 'stale';

export interface SnapshotAvailability {
  status: SnapshotAvailabilityStatus;
  message: string | null;
  expectedDate: string;
  latestSnapshotDate: string;
}

export function buildSnapshotAvailability(
  latestSnapshotDate: string,
  now = new Date(),
  timeZone = getTimezone(),
): SnapshotAvailability {
  const expectedDate = formatISODateInTimezone(now, timeZone);
  return {
    status: 'current',
    message: null,
    expectedDate,
    latestSnapshotDate,
  };
}
