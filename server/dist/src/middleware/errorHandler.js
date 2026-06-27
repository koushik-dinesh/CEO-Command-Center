import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
export function errorHandler(error, _req, res, _next) {
    if (error instanceof ZodError) {
        res.status(400).json({ message: 'Validation failed', issues: error.flatten() });
        return;
    }
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const customStatus = error && typeof error === 'object' && 'statusCode' in error
        ? Number(error.statusCode)
        : undefined;
    const status = customStatus && customStatus >= 400 && customStatus < 600
        ? customStatus
        : message.includes('Invalid email or password') ? 401 : 500;
    res.status(status).json({ message: isProduction && status === 500 ? 'Unexpected server error' : message });
}
