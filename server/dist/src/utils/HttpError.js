export class HttpError extends Error {
    statusCode;
    code;
    constructor(message, statusCode, code) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.code = code;
    }
}
export function unauthorized(message = 'Authentication required') {
    return new HttpError(message, 401, 'UNAUTHORIZED');
}
export function badRequest(message) {
    return new HttpError(message, 400, 'BAD_REQUEST');
}
export function tooManyRequests(message = 'Too many requests') {
    return new HttpError(message, 429, 'TOO_MANY_REQUESTS');
}
export function isHttpError(error) {
    return error instanceof HttpError;
}
export function statusCodeFromError(error) {
    if (isHttpError(error))
        return error.statusCode;
    if (error && typeof error === 'object' && 'statusCode' in error) {
        const code = Number(error.statusCode);
        if (code >= 400 && code < 600)
            return code;
    }
    return undefined;
}
