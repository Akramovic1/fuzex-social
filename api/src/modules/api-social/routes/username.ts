import { Hono } from 'hono';

import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';
import { type UsersRepository } from '@/shared/db/repositories/index.js';
import { BadRequestError } from '@/shared/errors/index.js';

import { isUsernameReserved, validateUsernameFormat } from '../lib/index.js';

export interface UsernameRoutesDeps {
  readonly usersRepository: UsersRepository;
}

/**
 * Builds the `/v1/username/*` sub-router.
 *
 * @param deps - The shared `UsersRepository`.
 * @returns A Hono router.
 */
export function buildUsernameRoutes(deps: UsernameRoutesDeps): Hono {
  const router = new Hono();

  router.get('/check', async (c) => {
    const username = c.req.query('username');
    if (username === undefined || username.length === 0) {
      throw new BadRequestError('missing username query parameter');
    }

    const lower = username.toLowerCase();

    const formatResult = validateUsernameFormat(lower);
    if (!formatResult.ok) {
      return c.json(
        { username: lower, available: false, reason: formatResult.reason },
        HTTP_STATUS.OK,
      );
    }

    if (isUsernameReserved(lower)) {
      return c.json({ username: lower, available: false, reason: 'RESERVED' }, HTTP_STATUS.OK);
    }

    const existing = await deps.usersRepository.findByUsername(lower);
    return c.json(
      {
        username: lower,
        available: existing === null,
        reason: existing === null ? null : 'ALREADY_TAKEN',
      },
      HTTP_STATUS.OK,
    );
  });

  return router;
}
