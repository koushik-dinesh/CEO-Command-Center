import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { DashboardService } from '../services/DashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(async (_req, res) => {
  res.json(await DashboardService.getDashboard());
}));

export default router;
