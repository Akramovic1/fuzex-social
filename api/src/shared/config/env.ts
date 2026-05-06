import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'production', 'test']);

const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);

const portSchema = z.coerce
  .number()
  .int()
  .min(1, 'PORT must be >= 1')
  .max(65535, 'PORT must be <= 65535');

const positiveIntSchema = z.coerce.number().int().positive();

const csvSchema = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: portSchema.default(3001),
  LOG_LEVEL: logLevelSchema.default('info'),

  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  HANDLE_DOMAIN: z
    .string()
    .startsWith('.', 'HANDLE_DOMAIN must start with a dot (e.g., ".dev.fuzex.app")'),
  PDS_URL: z.string().url('PDS_URL must be a valid URL'),

  CORS_ALLOWED_ORIGINS: csvSchema.default(''),

  RATE_LIMIT_WINDOW_MS: positiveIntSchema.default(60_000),
  RATE_LIMIT_MAX_REQUESTS: positiveIntSchema.default(100),

  // Phase 2: Firebase (for ID-token verification + Firestore reads)
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1, 'FIREBASE_SERVICE_ACCOUNT_PATH is required'),

  // Phase 2: PDS admin (for createInviteCode + createAccount + createSession)
  PDS_ADMIN_USERNAME: z.string().default('admin'),
  PDS_ADMIN_PASSWORD: z.string().min(1, 'PDS_ADMIN_PASSWORD is required'),
  // z.coerce.boolean() is broken for strings (any non-empty string is truthy),
  // so we parse explicit "true"/"false" ourselves.
  PDS_INVITE_REQUIRED: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() === 'true'),

  // Phase 2: user defaults
  DEFAULT_WALLET_CHAIN: z.string().default('ethereum'),
  SYNTHETIC_EMAIL_DOMAIN: z.string().default('email.fuzex.app'),
  MIN_USER_AGE: z.coerce.number().int().min(0).default(13),

  // Phase 2: encrypts per-user PDS passwords stored in Postgres.
  // Phase 3 will move these to a dedicated Secret Manager — see ADR 0006.
  PDS_PASSWORD_ENCRYPTION_KEY: z
    .string()
    .min(32, 'PDS_PASSWORD_ENCRYPTION_KEY must be at least 32 characters'),
});

export type Env = z.infer<typeof envSchema>;
