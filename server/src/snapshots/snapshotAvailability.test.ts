import { describe, expect, it } from 'vitest';
import { buildSnapshotAvailability } from './snapshotAvailability.js';
import { isDiscoveryWindowMinute } from './snapshotSchedule.js';

describe('snapshotAvailability', () => {
  it('never surfaces a missing-day warning', () => {
    const result = buildSnapshotAvailability('2026-06-17', new Date('2026-06-18T04:30:00.000Z'), 'Asia/Kolkata');
    expect(result.status).toBe('current');
    expect(result.message).toBeNull();
  });

  it('returns metadata without warning when latest snapshot is today', () => {
    const result = buildSnapshotAvailability('2026-06-18', new Date('2026-06-18T02:00:00.000Z'), 'Asia/Kolkata');
    expect(result.status).toBe('current');
    expect(result.message).toBeNull();
    expect(result.latestSnapshotDate).toBe('2026-06-18');
  });
});

describe('snapshotSchedule', () => {
  it('matches discovery window cadence', () => {
    expect(isDiscoveryWindowMinute(new Date('2026-06-18T01:55:00.000Z'), 'Asia/Kolkata')).toBe(true);
    expect(isDiscoveryWindowMinute(new Date('2026-06-18T02:02:00.000Z'), 'Asia/Kolkata')).toBe(false);
    expect(isDiscoveryWindowMinute(new Date('2026-06-18T03:30:00.000Z'), 'Asia/Kolkata')).toBe(true);
  });
});
