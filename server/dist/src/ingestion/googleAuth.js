import { existsSync, readFileSync } from 'node:fs';
import { google } from 'googleapis';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
];
function parseServiceAccountJson(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed);
    }
    // Common misconfiguration: file path stored in GOOGLE_SERVICE_ACCOUNT_JSON
    if (existsSync(trimmed)) {
        logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON is a file path — use GOOGLE_APPLICATION_CREDENTIALS instead', {
            operation: 'googleAuth',
            path: trimmed,
        });
        return JSON.parse(readFileSync(trimmed, 'utf8'));
    }
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be inline JSON or a valid file path. Prefer GOOGLE_APPLICATION_CREDENTIALS for key files.');
}
export function createGoogleAuth() {
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
        const credentials = parseServiceAccountJson(env.GOOGLE_SERVICE_ACCOUNT_JSON);
        return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    }
    if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error('Google credentials are not configured (set GOOGLE_APPLICATION_CREDENTIALS)');
    }
    return new google.auth.GoogleAuth({
        keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: SCOPES,
    });
}
