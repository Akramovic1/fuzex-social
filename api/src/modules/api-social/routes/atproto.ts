import { Hono } from 'hono';

import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';
import {
  createFirebaseAuthMiddleware,
  getFirebaseAuthContext,
} from '@/shared/middleware/firebaseAuth.js';

import { type CreateAccountService, type GetSessionService } from '../services/index.js';

export interface AtprotoRoutesDeps {
  readonly createAccountService: CreateAccountService;
  readonly getSessionService: GetSessionService;
}

/**
 * Builds the atproto sub-router (`/v1/atproto/*`).
 *
 * All routes require a verified Firebase ID token.
 *
 * @param deps - Injected services.
 * @returns A Hono router.
 */
export function buildAtprotoRoutes(deps: AtprotoRoutesDeps): Hono {
  const router = new Hono();

  router.use('*', createFirebaseAuthMiddleware());

  router.post('/createAccount', async (c) => {
    const auth = getFirebaseAuthContext(c);
    const correlationId = c.get('correlationId');

    const result = await deps.createAccountService.execute({
      firebaseAuth: auth,
      correlationId,
    });

    return c.json(
      {
        did: result.did,
        handle: result.handle,
        displayName: result.displayName,
      },
      HTTP_STATUS.CREATED,
    );
  });

  router.post('/getSession', async (c) => {
    const auth = getFirebaseAuthContext(c);

    const session = await deps.getSessionService.execute({
      firebaseUid: auth.uid,
    });

    return c.json(session, HTTP_STATUS.OK);
  });

  return router;
}
