import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { DashboardService } from '../services/DashboardService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
router.get('/latest', requireAuth, asyncHandler(async (_req, res) => {
    const dashboard = await DashboardService.getDashboard();
    res.json({ kpis: dashboard.kpis });
}));
export default router;
