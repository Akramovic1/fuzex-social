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
});

export type Env = z.infer<typeof envSchema>;
