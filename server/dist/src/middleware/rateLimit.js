import { tooManyRequests } from '../utils/HttpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const buckets = new Map();
function clientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0]?.trim() ?? req.ip;
    }
    return req.ip ?? 'unknown';
}
export function createRateLimiter(options) {
    return asyncHandler(async (req, _res, next) => {
        const key = `${options.name}:${clientIp(req)}`;
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            bucket = { count: 0, resetAt: now + options.windowMs };
            buckets.set(key, bucket);
        }
        bucket.count += 1;
        if (bucket.count > options.max) {
            throw tooManyRequests();
        }
        next();
    });
}
