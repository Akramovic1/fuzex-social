import { type Context, type MiddlewareHandler } from 'hono';

import { config } from '@/shared/config/index.js';
import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';

interface BucketState {
  tokens: number;
  resetAt: number;
}

interface RateLimitOptions {
  /** Window in milliseconds. Defaults to config.RATE_LIMIT_WINDOW_MS. */
  readonly windowMs?: number;
  /** Max requests per window. Defaults to config.RATE_LIMIT_MAX_REQUESTS. */
  readonly maxRequests?: number;
  /** Function deriving the rate-limit key from the request context. */
  readonly keyResolver?: (c: Context) => string;
}

const DEFAULT_KEY_RESOLVER: NonNullable<RateLimitOptions['keyResolver']> = (c) => {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded !== undefined && forwarded.length > 0) {
    const first = forwarded.split(',')[0];
    if (first !== undefined) {
      return first.trim();
    }
  }
  return c.req.header('x-real-ip') ?? 'unknown';
};

/**
 * Creates an in-memory rate-limiting middleware.
 *
 * State is process-local. With multiple processes (pm2 cluster mode)
 * each will have its own counter. Acceptable for Phase 1 single-instance
 * dev/prod. Swap for a Redis-backed limiter when scaling out.
 *
 * @param options - Window, max, and key resolver overrides.
 * @returns A Hono middleware handler.
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}): MiddlewareHandler {
  const windowMs = options.windowMs ?? config.env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? config.env.RATE_LIMIT_MAX_REQUESTS;
  const keyResolver = options.keyResolver ?? DEFAULT_KEY_RESOLVER;

  const buckets = new Map<string, BucketState>();

  return async (c, next) => {
    const key = keyResolver(c);
    const now = Date.now();

    let state = buckets.get(key);
    if (state === undefined || state.resetAt <= now) {
      state = { tokens: maxRequests, resetAt: now + windowMs };
      buckets.set(key, state);
    }

    if (state.tokens <= 0) {
      const retryAfterSeconds = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
      c.header('Retry-After', String(retryAfterSeconds));
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', String(Math.floor(state.resetAt / 1000)));
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
          },
        },
        HTTP_STATUS.TOO_MANY_REQUESTS,
      );
    }

    state.tokens -= 1;
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(state.tokens));
    c.header('X-RateLimit-Reset', String(Math.floor(state.resetAt / 1000)));

    await next();
    return;
  };
}
