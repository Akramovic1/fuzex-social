import 'dotenv/config';
import { z } from 'zod';

import { envSchema, type Env } from './env.js';

interface Config {
  readonly env: Env;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly isTest: boolean;
}

/**
 * Parses and validates process.env against the env schema.
 * Throws ZodError if invalid (caller should format and exit).
 *
 * @returns The validated environment object.
 */
function parseEnv(): Env {
  return envSchema.parse(process.env);
}

/**
 * Formats a ZodError for human-readable terminal output.
 *
 * @param error - The ZodError to format.
 * @returns A multi-line human-readable string.
 */
function formatZodError(error: z.ZodError): string {
  const lines = error.errors.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    return `  • ${path}: ${issue.message}`;
  });
  return `Environment validation failed:\n${lines.join('\n')}`;
}

function buildConfig(): Config {
  let env: Env;
  try {
    env = parseEnv();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // process.stderr is used directly here because the logger depends on
      // a valid LOG_LEVEL — chicken-and-egg if config itself is broken.
      process.stderr.write(`${formatZodError(error)}\n`);
      process.exit(1);
    }
    throw error;
  }

  return {
    env,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  };
}

export const config: Config = buildConfig();
