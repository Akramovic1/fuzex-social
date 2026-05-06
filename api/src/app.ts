import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { config } from '@/shared/config/index.js';
import {
  correlationIdMiddleware,
  rateLimitMiddleware,
  registerErrorHandler,
  requestLoggerMiddleware,
} from '@/shared/middleware/index.js';

/**
 * Builds and returns a fully-configured Hono application.
 *
 * Middleware order (intentional):
 *   1. correlationId — first so all later logs/errors have it
 *   2. CORS — early so preflight responses are correct even if rate-limited
 *   3. requestLogger — wraps next() to log post-response
 *   4. rateLimit — applied to all routes
 *   5. registerErrorHandler — onError handler (registered last, but global)
 *
 * @returns A configured Hono app instance.
 */
export function buildApp(): Hono {
  const app = new Hono();

  app.use('*', correlationIdMiddleware());

  app.use(
    '*',
    cors({
      origin: config.env.CORS_ALLOWED_ORIGINS,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposeHeaders: [
        'X-Request-Id',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
      credentials: false,
      maxAge: 600,
    }),
  );

  app.use('*', requestLoggerMiddleware());
  app.use('*', rateLimitMiddleware());

  registerErrorHandler(app);

  return app;
}
