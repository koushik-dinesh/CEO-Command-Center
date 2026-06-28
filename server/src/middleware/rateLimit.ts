import type { NextFunction, Request, Response } from 'express';
import { tooManyRequests } from '../utils/HttpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? req.ip;
  }
  return req.ip ?? 'unknown';
}

export function createRateLimiter(options: { windowMs: number; max: number; name: string }) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
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
