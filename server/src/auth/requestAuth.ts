import type { Request } from 'express';
import { env } from '../config/env.js';
import { AuthService, type AuthUser } from '../services/AuthService.js';

export function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith('Bearer ')) return undefined;
  const token = authorizationHeader.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

/** Bearer takes priority over cookie so a fresh client token wins over a stale httpOnly cookie. */
export function extractAuthToken(req: Pick<Request, 'cookies' | 'headers'>): string | undefined {
  const bearer = extractBearerToken(req.headers.authorization);
  const cookie = req.cookies?.[env.AUTH_COOKIE_NAME];
  return bearer ?? cookie;
}

export interface ResolvedAuth {
  user: AuthUser | null;
  token: string | null;
}

export async function resolveRequestAuth(req: Pick<Request, 'cookies' | 'headers'>): Promise<ResolvedAuth> {
  const token = extractAuthToken(req);
  if (!token) return { user: null, token: null };
  const user = await AuthService.verifyToken(token);
  return { user, token };
}
