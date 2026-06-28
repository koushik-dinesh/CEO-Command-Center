import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function resolveAuthCookieSecure(): boolean {
  if (env.AUTH_COOKIE_SECURE !== undefined) return env.AUTH_COOKIE_SECURE;
  return env.CLIENT_ORIGIN.startsWith('https://');
}

export function authCookieOptions(maxAge = SESSION_MAX_AGE_MS): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: resolveAuthCookieSecure(),
    path: '/',
    maxAge,
  };
}
