export class HttpError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function unauthorized(message = 'Authentication required'): HttpError {
  return new HttpError(message, 401, 'UNAUTHORIZED');
}

export function badRequest(message: string): HttpError {
  return new HttpError(message, 400, 'BAD_REQUEST');
}

export function tooManyRequests(message = 'Too many requests'): HttpError {
  return new HttpError(message, 429, 'TOO_MANY_REQUESTS');
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function statusCodeFromError(error: unknown): number | undefined {
  if (isHttpError(error)) return error.statusCode;
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = Number((error as { statusCode?: number }).statusCode);
    if (code >= 400 && code < 600) return code;
  }
  return undefined;
}
