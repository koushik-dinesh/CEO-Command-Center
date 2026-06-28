import { env } from './env.js';
function parseOrigin(url) {
    try {
        return new URL(url);
    }
    catch {
        return null;
    }
}
function buildAllowedOrigins() {
    const origins = new Set();
    const primary = parseOrigin(env.CLIENT_ORIGIN);
    if (primary)
        origins.add(primary.origin);
    for (const entry of env.ALLOWED_ORIGINS) {
        const parsed = parseOrigin(entry);
        if (parsed)
            origins.add(parsed.origin);
    }
    return origins;
}
const allowedOrigins = buildAllowedOrigins();
const clientOrigin = parseOrigin(env.CLIENT_ORIGIN);
export const corsOptions = {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    origin(origin, callback) {
        // Same-origin navigation and server-to-server requests
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.has(origin)) {
            callback(null, true);
            return;
        }
        // Allow same host on a different port (e.g. :5173 dev UI → :80 nginx API during rollout)
        if (clientOrigin) {
            try {
                const requestOrigin = new URL(origin);
                if (requestOrigin.hostname === clientOrigin.hostname) {
                    callback(null, true);
                    return;
                }
            }
            catch {
                // ignore invalid origin
            }
        }
        callback(null, false);
    },
};
