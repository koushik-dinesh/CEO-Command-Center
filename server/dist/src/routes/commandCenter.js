import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CommandCenterService } from '../command-center/CommandCenterService.js';
import { SnapshotDiscoveryService } from '../snapshots/SnapshotDiscoveryService.js';
import { ReportSnapshotRepository } from '../repositories/ReportSnapshotRepository.js';
const router = Router();
const service = new CommandCenterService();
const discoveryService = new SnapshotDiscoveryService();
router.get('/snapshots', requireAuth, asyncHandler(async (_req, res) => {
    res.json({ snapshots: await ReportSnapshotRepository.listBatches(200) });
}));
router.get('/dashboard', requireAuth, asyncHandler(async (req, res) => {
    const snapshotKey = typeof req.query.snapshotKey === 'string' ? req.query.snapshotKey : undefined;
    const filters = {
        salesperson: typeof req.query.salesperson === 'string' ? req.query.salesperson : undefined,
        customerGroup: typeof req.query.customerGroup === 'string' ? req.query.customerGroup : undefined,
        productGroup: typeof req.query.productGroup === 'string' ? req.query.productGroup : undefined,
        warehouse: typeof req.query.warehouse === 'string' ? req.query.warehouse : undefined,
    };
    res.json(await service.getDashboard(snapshotKey, filters));
}));
router.get('/compare', requireAuth, asyncHandler(async (req, res) => {
    const current = typeof req.query.current === 'string' ? req.query.current : undefined;
    const previous = typeof req.query.previous === 'string' ? req.query.previous : undefined;
    if (!current || !previous) {
        res.status(400).json({ message: 'Both current and previous snapshot keys are required' });
        return;
    }
    res.json(await service.compare(current, previous));
}));
router.post('/sync', requireAuth, asyncHandler(async (_req, res) => {
    const { runId } = await discoveryService.startAsync('MANUAL');
    res.status(202).json({ runId, status: 'running' });
}));
router.get('/sync/:runId', requireAuth, asyncHandler(async (req, res) => {
    const runId = typeof req.params.runId === 'string' ? req.params.runId : '';
    const status = await discoveryService.getStatus(runId);
    if (!status) {
        res.status(404).json({ message: 'Sync run not found' });
        return;
    }
    res.json(status);
}));
export default router;
