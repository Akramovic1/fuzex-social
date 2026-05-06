import { type MiddlewareHandler } from 'hono';

import { logger } from '@/shared/logger/index.js';

/**
 * Logs each request after the response is sent.
 * Must be mounted AFTER correlationIdMiddleware.
 *
 * @returns A Hono middleware handler.
 */
export function requestLoggerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    const startedAt = c.get('requestStartedAt');
    const correlationId = c.get('correlationId');
    const durationMs = Date.now() - startedAt;

    logger.info(
      {
        correlationId,
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      'request completed',
    );
  };
}
