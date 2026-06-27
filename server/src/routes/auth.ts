import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { AuthService } from '../services/AuthService.js';
import { authCookieOptions } from '../utils/authCookie.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function readAuthToken(req: { cookies?: Record<string, string>; headers: { authorization?: string } }): string | undefined {
  const cookieToken = req.cookies?.[env.AUTH_COOKIE_NAME];
  const bearerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  return cookieToken ?? bearerToken;
}

router.post('/login', asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const { user, token } = await AuthService.login(payload.email, payload.password);
  res.cookie(env.AUTH_COOKIE_NAME, token, authCookieOptions());
  res.json({ user });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, authCookieOptions(0));
  res.json({ ok: true });
});

router.get('/me', asyncHandler(async (req, res) => {
  const token = readAuthToken(req);
  if (!token) {
    res.json({ user: null });
    return;
  }

  const user = await AuthService.verifyToken(token);
  res.json({ user });
}));

router.get('/session', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
