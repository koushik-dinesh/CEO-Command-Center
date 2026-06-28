import { ZodError } from 'zod';
import { isHttpError, statusCodeFromError } from '../utils/HttpError.js';
import { logger } from '../utils/logger.js';
function controllerFromRequest(req) {
    const base = req.baseUrl || '';
    const route = req.route && typeof req.route.path === 'string' ? req.route.path : '';
    return `${req.method} ${base}${route}` || req.originalUrl;
}
export function errorHandler(error, req, res, _next) {
    const path = req.originalUrl;
    const operation = controllerFromRequest(req);
    if (error instanceof ZodError) {
        logger.warn('validation failed', {
            operation,
            path,
            issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        });
        res.status(400).json({
            message: 'Validation failed',
            issues: error.issues,
        });
        return;
    }
    if (isHttpError(error)) {
        if (error.statusCode >= 500) {
            logger.error(error.message, {
                operation,
                path,
                stack: error.stack,
                statusCode: error.statusCode,
            });
        }
        res.status(error.statusCode).json({ message: error.message, code: error.code });
        return;
    }
    const statusCode = statusCodeFromError(error) ?? 500;
    const message = error instanceof Error ? error.message : 'Internal server error';
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(message, {
        operation,
        path,
        stack,
        statusCode,
    });
    res.status(statusCode).json({
        message: statusCode >= 500 ? 'Internal server error' : message,
    });
}
