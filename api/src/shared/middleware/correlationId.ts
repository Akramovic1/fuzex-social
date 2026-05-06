import { randomUUID } from 'node:crypto';

import { type MiddlewareHandler } from 'hono';

const HEADER_NAME = 'x-request-id';

/**
 * Middleware that ensures every request has a correlation ID.
 *
 * - If the inbound request has an `X-Request-Id` header, it is reused.
 * - Otherwise a new UUIDv4 is generated.
 * - The ID is stored on the Hono context (`c.get('correlationId')`)
 *   and echoed back in the response header.
 *
 * @returns A Hono middleware handler.
 */
export function correlationIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header(HEADER_NAME);
    const correlationId = incoming !== undefined && incoming.length > 0 ? incoming : randomUUID();

    c.set('correlationId', correlationId);
    c.set('requestStartedAt', Date.now());
    c.header(HEADER_NAME, correlationId);

    await next();
  };
}
