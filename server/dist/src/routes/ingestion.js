import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { IngestionService } from '../ingestion/IngestionService.js';
import { ProcessingStatus } from '../db/types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
router.post('/run', requireAuth, asyncHandler(async (_req, res) => {
    const { snapshotResult, sourceResults } = await new IngestionService().runAll('manual', {
        forceSnapshotRefresh: true,
        alwaysRecalculateKpis: true,
    });
    const newDataFound = sourceResults.some((result) => result.status === ProcessingStatus.SUCCESS || result.status === ProcessingStatus.PARTIAL)
        || snapshotResult.processed > 0;
    res.json({
        message: newDataFound ? 'Synced from Google Drive and updated dashboard data' : 'Synced from Google Drive — no new files detected',
        newDataFound,
        results: sourceResults,
        snapshot: snapshotResult,
    });
}));
export default router;
