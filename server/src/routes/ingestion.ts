import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { UnifiedSyncService } from '../sync/UnifiedSyncService.js';
import { ProcessingStatus } from '../db/types.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/run', requireAuth, asyncHandler(async (_req, res) => {
  const result = await new UnifiedSyncService().run({
    syncType: 'MANUAL',
    forceSnapshotRefresh: true,
    alwaysRecalculateKpis: true,
  });

  const newDataFound = result.sourceResults.some((sourceResult) => sourceResult.status === ProcessingStatus.SUCCESS || sourceResult.status === ProcessingStatus.PARTIAL)
    || result.snapshotResult.processed > 0;

  res.json({
    message: newDataFound ? 'Synced from Google Drive and updated dashboard data' : 'Synced from Google Drive — no new files detected',
    newDataFound,
    results: result.sourceResults,
    snapshot: result.snapshotResult,
  });
}));

export default router;
