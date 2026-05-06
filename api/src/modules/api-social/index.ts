import { Hono } from 'hono';

import { type Database } from '@/shared/db/index.js';

import { buildHealthRoutes } from './routes/index.js';

export interface ApiSocialModuleDeps {
  readonly db: Database;
}

/**
 * Mounts all routes for the api-social module.
 *
 * The module exposes:
 *   - GET /health
 *
 * Future prompts will add /.well-known/atproto-did and /v1/resolve/:handle.
 *
 * @param deps - The module's dependencies.
 * @returns A Hono router with all api-social routes mounted.
 */
export function buildApiSocialModule(deps: ApiSocialModuleDeps): Hono {
  const router = new Hono();
  router.route('/', buildHealthRoutes({ db: deps.db }));
  return router;
}
