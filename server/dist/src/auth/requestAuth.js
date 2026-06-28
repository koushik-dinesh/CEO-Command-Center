import { env } from '../config/env.js';
import { AuthService } from '../services/AuthService.js';
export function extractBearerToken(authorizationHeader) {
    if (!authorizationHeader?.startsWith('Bearer '))
        return undefined;
    const token = authorizationHeader.slice(7).trim();
    return token.length > 0 ? token : undefined;
}
/** Bearer takes priority over cookie so a fresh client token wins over a stale httpOnly cookie. */
export function extractAuthToken(req) {
    const bearer = extractBearerToken(req.headers.authorization);
    const cookie = req.cookies?.[env.AUTH_COOKIE_NAME];
    return bearer ?? cookie;
}
export async function resolveRequestAuth(req) {
    const token = extractAuthToken(req);
    if (!token)
        return { user: null, token: null };
    const user = await AuthService.verifyToken(token);
    return { user, token };
}
