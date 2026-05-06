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

    // Validate the user's input AS-IS. Do NOT lowercase first — uppercase is
    // an explicit format failure (UPPERCASE_NOT_ALLOWED), not something to
    // silently accept.
    const formatResult = validateUsernameFormat(username);
    if (!formatResult.ok) {
      return c.json({ username, available: false, reason: formatResult.reason }, HTTP_STATUS.OK);
    }

    // After validation succeeds we know `username` is provably already
    // lowercase (the validator rejects anything else). DB lookup uses it
    // directly — no extra normalization needed.
    if (isUsernameReserved(username)) {
      return c.json({ username, available: false, reason: 'RESERVED' }, HTTP_STATUS.OK);
    }

    const existing = await deps.usersRepository.findByUsername(username);
    return c.json(
      {
        username,
        available: existing === null,
        reason: existing === null ? null : 'ALREADY_TAKEN',
      },
      HTTP_STATUS.OK,
    );
  });

  return router;
}
