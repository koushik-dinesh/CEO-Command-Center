import { Router } from 'express';
import { pingDatabase } from '../db/mysql.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
const router = Router();
router.get('/', asyncHandler(async (req, res) => {
    try {
        await pingDatabase();
        res.json({
            ok: true,
            service: 'ceo-command-center-api',
            db: 'up',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        logger.error('health check database ping failed', {
            operation: 'health.check',
            path: req.originalUrl,
            stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(503).json({
            ok: false,
            service: 'ceo-command-center-api',
            db: 'down',
            timestamp: new Date().toISOString(),
        });
    }
}));
export default router;
