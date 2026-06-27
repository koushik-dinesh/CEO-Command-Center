import { describe, expect, it } from 'vitest';
import {
  isCompleteReportCount,
  isCompleteSnapshotBatch,
  REQUIRED_SNAPSHOT_REPORT_TYPES,
} from './snapshotCompleteness.js';

describe('snapshotCompleteness', () => {
  it('requires all six report types', () => {
    expect(isCompleteReportCount(6)).toBe(true);
    expect(isCompleteReportCount(5)).toBe(false);
    expect(isCompleteSnapshotBatch(REQUIRED_SNAPSHOT_REPORT_TYPES)).toBe(true);
    expect(isCompleteSnapshotBatch(REQUIRED_SNAPSHOT_REPORT_TYPES.slice(0, 5))).toBe(false);
  });
});
