import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { PbtService, validateExpenseValue, validateMonthYear, } from '../pbt/PbtService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = Router();
const pbtService = new PbtService();
router.post('/inputs', requireAuth, asyncHandler(async (req, res) => {
    const { month, year } = validateMonthYear(req.body.month, req.body.year);
    const directExpense = validateExpenseValue(req.body.directExpense, 'Direct expense');
    const additionalIndirectExpense = validateExpenseValue(req.body.additionalIndirectExpense ?? req.body.indirectExpense, 'Additional indirect expense');
    const record = await pbtService.createInput(req.user.id, month, year, directExpense, additionalIndirectExpense);
    res.status(201).json(record);
}));
router.put('/inputs/:year/:month', requireAuth, asyncHandler(async (req, res) => {
    const { month, year } = validateMonthYear(req.params.month, req.params.year);
    const directExpense = validateExpenseValue(req.body.directExpense, 'Direct expense');
    const additionalIndirectExpense = validateExpenseValue(req.body.additionalIndirectExpense ?? req.body.indirectExpense, 'Additional indirect expense');
    const record = await pbtService.updateInput(month, year, directExpense, additionalIndirectExpense);
    res.json(record);
}));
router.get('/inputs/:year/:month', requireAuth, asyncHandler(async (req, res) => {
    const { month, year } = validateMonthYear(req.params.month, req.params.year);
    const record = await pbtService.getByMonthYear(month, year);
    res.json(record);
}));
router.get('/inputs', requireAuth, asyncHandler(async (_req, res) => {
    const records = await pbtService.listHistorical();
    res.json({ records });
}));
router.get('/calculated', requireAuth, asyncHandler(async (_req, res) => {
    const records = await pbtService.listCalculated();
    const intelligence = await pbtService.buildIntelligence();
    res.json({ records, intelligence });
}));
router.get('/hr-expense/:year/:month', requireAuth, asyncHandler(async (req, res) => {
    const { month, year } = validateMonthYear(req.params.month, req.params.year);
    const hrExpense = await pbtService.getHrExpenseForMonth(month, year);
    res.json({ month, year, hrExpense });
}));
router.get('/revenue/:year/:month', requireAuth, asyncHandler(async (req, res) => {
    const { month, year } = validateMonthYear(req.params.month, req.params.year);
    const revenue = await pbtService.getRevenueForMonth(month, year);
    res.json({ month, year, revenue });
}));
export default router;
