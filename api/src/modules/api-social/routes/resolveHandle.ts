import { Hono } from 'hono';

import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';

import { resolveHandleResponseSchema } from '../schemas/responses.js';
import { type UserResolver } from '../services/index.js';

interface ResolveHandleRouteDeps {
  readonly userResolver: UserResolver;
}

/**
 * Builds a Hono sub-router exposing GET /v1/resolve/:handle.
 *
 * - 200 with JSON body matching `resolveHandleResponseSchema`
 * - Errors propagate to the global error handler (HandleResolutionError → 4xx)
 *
 * @param deps - Injected dependencies.
 * @returns A Hono router.
 */
export function buildResolveHandleRoutes(deps: ResolveHandleRouteDeps): Hono {
  const router = new Hono();

  router.get('/v1/resolve/:handle', async (c) => {
    const handle = c.req.param('handle');

    const summary = await deps.userResolver.resolveHandleForTipping(handle);
    // Validate the response shape at runtime. zod's overhead is negligible for
    // a small object and gives us a self-test against schema drift.
    const validated = resolveHandleResponseSchema.parse(summary);

    return c.json(validated, HTTP_STATUS.OK, {
      'Cache-Control': 'public, max-age=60',
    });
  });

  return router;
}
