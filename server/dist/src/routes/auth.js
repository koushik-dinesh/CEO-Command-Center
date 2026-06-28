import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { resolveRequestAuth } from '../auth/requestAuth.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { AuthService } from '../services/AuthService.js';
import { authCookieOptions } from '../utils/authCookie.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const loginRateLimit = createRateLimiter({
    name: 'auth-login',
    windowMs: 15 * 60 * 1000,
    max: 30,
});
router.post('/login', loginRateLimit, asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    try {
        const { user, token } = await AuthService.login(payload.email, payload.password);
        res.cookie(env.AUTH_COOKIE_NAME, token, authCookieOptions());
        logger.info('login success', { operation: 'auth.login', path: req.originalUrl, userId: user.id });
        res.json({ user, token });
    }
    catch (error) {
        logger.warn('login failure', {
            operation: 'auth.login',
            path: req.originalUrl,
            email: payload.email,
        });
        throw error;
    }
}));
router.post('/logout', (_req, res) => {
    res.clearCookie(env.AUTH_COOKIE_NAME, authCookieOptions(0));
    res.json({ ok: true });
});
router.get('/me', asyncHandler(async (req, res) => {
    const { user } = await resolveRequestAuth(req);
    res.json({ user });
}));
router.get('/session', requireAuth, (req, res) => {
    res.json({ user: req.user });
});
export default router;
