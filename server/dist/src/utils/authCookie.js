import { env } from '../config/env.js';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/**
 * Secure cookies require HTTPS. Default follows CLIENT_ORIGIN (http → false, https → true).
 * Override with AUTH_COOKIE_SECURE=true|false on the server.
 */
export function resolveAuthCookieSecure() {
    const override = process.env.AUTH_COOKIE_SECURE;
    if (override === 'true')
        return true;
    if (override === 'false')
        return false;
    return env.CLIENT_ORIGIN.startsWith('https://');
}
export function authCookieOptions(maxAge = SESSION_MAX_AGE_MS) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: resolveAuthCookieSecure(),
        path: '/',
        maxAge,
    };
}
