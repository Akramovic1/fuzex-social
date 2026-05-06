import { Hono } from 'hono';

import { type Database } from '@/shared/db/index.js';
import { UsersRepository } from '@/shared/db/repositories/index.js';

import {
  buildAtprotoRoutes,
  buildHealthRoutes,
  buildResolveHandleRoutes,
  buildUsernameRoutes,
  buildWellKnownAtprotoDidRoutes,
} from './routes/index.js';
import {
  UserResolver,
  type CreateAccountService,
  type GetSessionService,
} from './services/index.js';

export interface ApiSocialModuleDeps {
  readonly db: Database;
  readonly handleDomain: string;
  /** Optional Phase 2 services. If absent, atproto routes are not mounted. */
  readonly createAccountService?: CreateAccountService;
  readonly getSessionService?: GetSessionService;
}

/**
 * Mounts all routes for the api-social module.
 *
 * Phase 1 routes (always mounted):
 *   GET /health
 *   GET /.well-known/atproto-did
 *   GET /v1/resolve/:handle
 *   GET /v1/username/check
 *
 * Phase 2 routes (mounted only when both services are provided):
 *   POST /v1/atproto/createAccount
 *   POST /v1/atproto/getSession
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
  router.route('/v1/username', buildUsernameRoutes({ usersRepository }));

  if (deps.createAccountService !== undefined && deps.getSessionService !== undefined) {
    router.route(
      '/v1/atproto',
      buildAtprotoRoutes({
        createAccountService: deps.createAccountService,
        getSessionService: deps.getSessionService,
      }),
    );
  }

  return router;
}
