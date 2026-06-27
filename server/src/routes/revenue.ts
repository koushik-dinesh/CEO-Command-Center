import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { RevenueService } from '../revenue/revenue-service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/drilldown', requireAuth, asyncHandler(async (req, res) => {
  const snapshotKey = typeof req.query.snapshotKey === 'string' ? req.query.snapshotKey : undefined;
  res.json(await new RevenueService().drilldown(snapshotKey));
}));

export default router;
