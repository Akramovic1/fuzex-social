import { pino, type Logger, type LoggerOptions } from 'pino';

import { config } from '@/shared/config/index.js';

const REDACTED_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'password',
  'passwd',
  'pwd',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'authorization',
  'cookie',
];

function buildLoggerOptions(): LoggerOptions {
  const baseOptions: LoggerOptions = {
    level: config.env.LOG_LEVEL,
    redact: {
      paths: [...REDACTED_PATHS],
      censor: '[REDACTED]',
    },
    base: {
      service: 'fuzex-api',
      env: config.env.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (config.isProduction) {
    return baseOptions;
  }

  return {
    ...baseOptions,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname,service,env',
        singleLine: false,
      },
    },
  };
}

export const logger: Logger = pino(buildLoggerOptions());

/**
 * Returns a child logger with extra bindings.
 * Use this for request-scoped or component-scoped loggers.
 *
 * @param bindings - Key-value pairs to attach to every log line.
 * @returns A new logger inheriting parent settings plus bindings.
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
