import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { DriveExplorerService } from '../services/DriveExplorerService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
router.get('/files', requireAuth, asyncHandler(async (_req, res) => {
    const result = await new DriveExplorerService().listConfiguredDriveFiles();
    res.json(result);
}));
export default router;
