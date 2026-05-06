import { Hono } from 'hono';

import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';
import { HandleResolutionError } from '@/shared/errors/index.js';

import { type UserResolver } from '../services/index.js';

interface WellKnownRouteDeps {
  readonly userResolver: UserResolver;
}

/**
 * Builds a Hono sub-router exposing GET /.well-known/atproto-did.
 *
 * - 200 with `text/plain; charset=utf-8` body containing the DID (no trailing newline)
 * - 404 with EMPTY body when handle does not resolve (atproto convention)
 * - All other errors propagate to the global error handler
 *
 * The endpoint reads the Host header to determine which user is being looked
 * up. Caddy will route `*.dev.fuzex.social/.well-known/atproto-did` here,
 * preserving the original Host.
 *
 * @param deps - Injected dependencies.
 * @returns A Hono router.
 */
export function buildWellKnownAtprotoDidRoutes(deps: WellKnownRouteDeps): Hono {
  const router = new Hono();

  router.get('/.well-known/atproto-did', async (c) => {
    const host = c.req.header('host');
    if (host === undefined || host.length === 0) {
      return c.body(null, HTTP_STATUS.NOT_FOUND);
    }

    try {
      const did = await deps.userResolver.resolveHostToDid(host);
      // Body is the bare DID — no trailing newline. atproto verifiers are strict.
      return c.body(did, HTTP_STATUS.OK, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      });
    } catch (err) {
      if (err instanceof HandleResolutionError) {
        // For atproto compatibility, ALL resolution failures return 404 with
        // empty body. Don't leak which usernames exist.
        return c.body(null, HTTP_STATUS.NOT_FOUND);
      }
      throw err;
    }
  });

  return router;
}
