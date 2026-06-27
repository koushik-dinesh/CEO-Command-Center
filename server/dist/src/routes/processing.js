import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ProcessingLogService } from '../services/ProcessingLogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
router.get('/status', requireAuth, asyncHandler(async (_req, res) => {
    res.json({ processing: await ProcessingLogService.latest(12) });
}));
export default router;
