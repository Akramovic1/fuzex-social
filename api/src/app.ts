import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { buildApiSocialModule } from '@/modules/api-social/index.js';
import { config } from '@/shared/config/index.js';
import { type Database } from '@/shared/db/index.js';
import {
  correlationIdMiddleware,
  rateLimitMiddleware,
  registerErrorHandler,
  requestLoggerMiddleware,
} from '@/shared/middleware/index.js';

export interface AppDependencies {
  readonly db: Database;
}

/**
 * Builds and returns a fully-configured Hono application with all routes mounted.
 *
 * Middleware order (intentional):
 *   1. correlationId — first so all later logs/errors have it
 *   2. CORS — early so preflight responses are correct even if rate-limited
 *   3. requestLogger — wraps next() to log post-response
 *   4. rateLimit — applied to all routes
 *   5. routes
 *   6. registerErrorHandler — onError handler (registered last, but global)
 *
 * @param deps - Application dependencies (DB, etc.).
 * @returns A configured Hono app instance.
 */
export function buildApp(deps: AppDependencies): Hono {
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

  app.route(
    '/',
    buildApiSocialModule({
      db: deps.db,
      handleDomain: config.env.HANDLE_DOMAIN,
    }),
  );

  registerErrorHandler(app);

  return app;
}
