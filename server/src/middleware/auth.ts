import type { NextFunction, Request, Response } from 'express';
import { resolveRequestAuth } from '../auth/requestAuth.js';
import { logger } from '../utils/logger.js';
import { unauthorized } from '../utils/HttpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { user } = await resolveRequestAuth(req);
  if (!user) {
    logger.warn('authentication failed', {
      operation: 'requireAuth',
      path: req.originalUrl,
    });
    throw unauthorized();
  }
  req.user = user;
  next();
});
