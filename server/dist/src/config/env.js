import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { z } from 'zod';
const currentDir = dirname(fileURLToPath(import.meta.url));
const envPaths = Array.from(new Set([
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
    resolve(currentDir, '..', '..', '..', '.env'),
    resolve(currentDir, '..', '..', '..', '..', '.env'),
]));
for (const envPath of envPaths) {
    if (existsSync(envPath)) {
        config({ path: envPath, override: false, quiet: true });
    }
}
const serverRoot = resolve(currentDir, '..', '..');
function resolveExistingPath(configuredPath) {
    const candidates = [
        configuredPath,
        resolve(process.cwd(), configuredPath),
        resolve(serverRoot, configuredPath),
        resolve(serverRoot, 'secrets', basename(configuredPath)),
        resolve(process.cwd(), 'secrets', basename(configuredPath)),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function looksLikeJson(value) {
    const trimmed = value.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
}
const boolFromEnv = z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true'));
const envSchema = z
    .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
    DB_HOST: z.string().min(1).default('127.0.0.1'),
    DB_PORT: z.coerce.number().int().positive().default(3306),
    DB_USER: z.string().min(1).default('ceo_user'),
    DB_PASSWORD: z.string().min(1).default('ceo_password'),
    DB_NAME: z.string().min(1).default('ceo_command_center'),
    DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
    JWT_SECRET: z.string().min(16),
    AUTH_COOKIE_NAME: z.string().min(1).default('ceo_cc_token'),
    AUTH_COOKIE_SECURE: boolFromEnv,
    INGESTION_CRON: z.string().min(1).default('0 6 * * *'),
    DEFAULT_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
    SNAPSHOT_DISCOVERY_START: z.string().min(1).default('07:25'),
    SNAPSHOT_DISCOVERY_END: z.string().min(1).default('09:00'),
    SNAPSHOT_DISCOVERY_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
    SNAPSHOT_MAINTENANCE_CRON: z.string().min(1).default('30 11,15,19,23 * * *'),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
    GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    ALLOWED_ORIGINS: z
        .string()
        .optional()
        .transform((value) => {
        if (!value?.trim())
            return [];
        return value.split(',').map((part) => part.trim()).filter(Boolean);
    }),
})
    .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === 'production';
    if (isProd) {
        try {
            const clientHost = new URL(data.CLIENT_ORIGIN).hostname;
            if (clientHost === 'localhost' || clientHost === '127.0.0.1') {
                ctx.addIssue({
                    code: 'custom',
                    path: ['CLIENT_ORIGIN'],
                    message: 'CLIENT_ORIGIN must be the public app URL in production (not localhost)',
                });
            }
        }
        catch {
            // url() schema already validates format
        }
    }
    if (isProd && data.JWT_SECRET.length < 32) {
        ctx.addIssue({
            code: 'custom',
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be at least 32 characters in production',
        });
    }
    const hasGoogleCreds = Boolean(data.GOOGLE_APPLICATION_CREDENTIALS?.trim()) ||
        Boolean(data.GOOGLE_SERVICE_ACCOUNT_JSON?.trim());
    if (isProd && !hasGoogleCreds) {
        ctx.addIssue({
            code: 'custom',
            path: ['GOOGLE_APPLICATION_CREDENTIALS'],
            message: 'GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON is required in production',
        });
    }
    if (data.GOOGLE_APPLICATION_CREDENTIALS) {
        const resolved = resolveExistingPath(data.GOOGLE_APPLICATION_CREDENTIALS);
        if (!resolved) {
            ctx.addIssue({
                code: 'custom',
                path: ['GOOGLE_APPLICATION_CREDENTIALS'],
                message: `Google credentials file not found: ${data.GOOGLE_APPLICATION_CREDENTIALS} (also checked server/secrets/)`,
            });
        }
    }
    if (data.GOOGLE_SERVICE_ACCOUNT_JSON && !looksLikeJson(data.GOOGLE_SERVICE_ACCOUNT_JSON)) {
        const asPath = resolveExistingPath(data.GOOGLE_SERVICE_ACCOUNT_JSON);
        if (!asPath) {
            ctx.addIssue({
                code: 'custom',
                path: ['GOOGLE_SERVICE_ACCOUNT_JSON'],
                message: 'GOOGLE_SERVICE_ACCOUNT_JSON must be inline JSON, not a file path. Use GOOGLE_APPLICATION_CREDENTIALS for a key file instead.',
            });
        }
    }
    for (const origin of data.ALLOWED_ORIGINS) {
        try {
            z.string().url().parse(origin);
        }
        catch {
            ctx.addIssue({
                code: 'custom',
                path: ['ALLOWED_ORIGINS'],
                message: `Invalid ALLOWED_ORIGINS entry: ${origin}`,
            });
        }
    }
});
function formatEnvError(error) {
    return error.issues
        .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'environment';
        return `  - ${path}: ${issue.message}`;
    })
        .join('\n');
}
let parsedEnv;
try {
    parsedEnv = envSchema.parse(process.env);
}
catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Environment validation failed:\n' + formatEnvError(error));
        process.exit(1);
    }
    throw error;
}
if (parsedEnv.GOOGLE_APPLICATION_CREDENTIALS) {
    const resolved = resolveExistingPath(parsedEnv.GOOGLE_APPLICATION_CREDENTIALS);
    if (resolved)
        parsedEnv.GOOGLE_APPLICATION_CREDENTIALS = resolved;
}
if (parsedEnv.GOOGLE_SERVICE_ACCOUNT_JSON && !looksLikeJson(parsedEnv.GOOGLE_SERVICE_ACCOUNT_JSON)) {
    const resolved = resolveExistingPath(parsedEnv.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (resolved) {
        parsedEnv.GOOGLE_SERVICE_ACCOUNT_JSON = readFileSync(resolved, 'utf8');
    }
}
export const env = parsedEnv;
export const isProduction = env.NODE_ENV === 'production';
