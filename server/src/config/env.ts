import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('ceo_user'),
  DB_PASSWORD: z.string().default('ceo_password'),
  DB_NAME: z.string().default('ceo_command_center'),
  DB_CONNECTION_LIMIT: z.coerce.number().default(10),
  JWT_SECRET: z.string().min(16),
  AUTH_COOKIE_NAME: z.string().default('ceo_cc_token'),
  INGESTION_CRON: z.string().default('0 6 * * *'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  SNAPSHOT_DISCOVERY_START: z.string().default('07:25'),
  SNAPSHOT_DISCOVERY_END: z.string().default('09:00'),
  SNAPSHOT_DISCOVERY_INTERVAL_MINUTES: z.coerce.number().default(5),
  SNAPSHOT_MAINTENANCE_CRON: z.string().default('30 11,15,19,23 * * *'),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
