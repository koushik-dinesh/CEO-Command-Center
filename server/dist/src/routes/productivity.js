import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ProductivityService } from '../productivity/ProductivityService.js';
import { validateHrExpenseValue, validateMonthYear } from '../productivity/productivityUtils.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
const productivityService = new ProductivityService();
router.get('/hr-expenses', requireAuth, asyncHandler(async (_req, res) => {
    const records = await productivityService.listHrExpenses();
    res.json({ records });
}));
router.post('/hr-expenses', requireAuth, asyncHandler(async (req, res) => {
    const { month, calendarYear } = validateMonthYear(req.body.month, req.body.year ?? req.body.calendarYear);
    const hrExpense = validateHrExpenseValue(req.body.hrExpense);
    const record = await productivityService.upsertHrExpense(req.user.id, month, calendarYear, hrExpense);
    res.status(201).json(record);
}));
router.put('/hr-expenses/:year/:month', requireAuth, asyncHandler(async (req, res) => {
    const { month, calendarYear } = validateMonthYear(req.params.month, req.params.year);
    const hrExpense = validateHrExpenseValue(req.body.hrExpense);
    const record = await productivityService.updateHrExpense(req.user.id, month, calendarYear, hrExpense);
    res.json(record);
}));
router.delete('/hr-expenses/:year/:month', requireAuth, asyncHandler(async (req, res) => {
    const { month, calendarYear } = validateMonthYear(req.params.month, req.params.year);
    await productivityService.deleteHrExpense(month, calendarYear);
    res.json({ ok: true });
}));
export default router;
