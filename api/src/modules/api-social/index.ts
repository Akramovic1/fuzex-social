import { Hono } from 'hono';

import { type Database } from '@/shared/db/index.js';
import { UsersRepository } from '@/shared/db/repositories/index.js';

import {
  buildHealthRoutes,
  buildResolveHandleRoutes,
  buildWellKnownAtprotoDidRoutes,
} from './routes/index.js';
import { UserResolver } from './services/index.js';

export interface ApiSocialModuleDeps {
  readonly db: Database;
  readonly handleDomain: string;
}

/**
 * Mounts all routes for the api-social module.
 *
 * Routes:
 *   GET /health
 *   GET /.well-known/atproto-did
 *   GET /v1/resolve/:handle
 *
 * @param deps - Injected dependencies.
 * @returns A Hono router with all api-social routes mounted.
 */
export function buildApiSocialModule(deps: ApiSocialModuleDeps): Hono {
  const router = new Hono();

  const usersRepository = new UsersRepository(deps.db);
  const userResolver = new UserResolver({
    usersRepository,
    handleDomain: deps.handleDomain,
  });

  router.route('/', buildHealthRoutes({ db: deps.db }));
  router.route('/', buildWellKnownAtprotoDidRoutes({ userResolver }));
  router.route('/', buildResolveHandleRoutes({ userResolver }));

  return router;
}
