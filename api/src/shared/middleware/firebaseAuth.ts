import { type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { type Context, type MiddlewareHandler } from 'hono';

import { UnauthorizedError } from '@/shared/errors/index.js';
import { getFirebaseAuth } from '@/shared/firebase/firebaseAdmin.js';
import { logger } from '@/shared/logger/index.js';

export interface FirebaseAuthContext {
  readonly uid: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly authProvider: string;
}

/**
 * Verifies the Firebase ID token from the Authorization header.
 * On success, attaches a {@link FirebaseAuthContext} under `c.get('firebaseAuth')`.
 * On failure, throws an {@link UnauthorizedError} (handled by the global error
 * middleware, which formats the 401 response).
 *
 * @param authProvider - Optional getter for the firebase-admin Auth instance,
 *   useful for injecting a mock during tests. Defaults to the singleton.
 * @returns A Hono middleware handler.
 */
export function createFirebaseAuthMiddleware(
  authProvider: () => Auth = getFirebaseAuth,
): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');

    if (header === undefined) {
      throw new UnauthorizedError('missing Authorization header');
    }

    if (!header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization header must use Bearer scheme');
    }

    const token = header.slice('Bearer '.length).trim();
    if (token.length === 0) {
      throw new UnauthorizedError('Bearer token is empty');
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await authProvider().verifyIdToken(token, true);
    } catch (err) {
      const correlationId = c.get('correlationId');
      logger.warn(
        { correlationId, err: (err as Error).message },
        'firebase token verification failed',
      );
      throw new UnauthorizedError('invalid or expired token');
    }

    const ctx: FirebaseAuthContext = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      phoneNumber: decoded.phone_number ?? null,
      emailVerified: decoded.email_verified ?? false,
      phoneVerified: decoded.phone_number !== undefined && decoded.phone_number !== null,
      authProvider: decoded.firebase?.sign_in_provider ?? 'unknown',
    };

    c.set('firebaseAuth', ctx);

    await next();
  };
}

/**
 * Reads the verified Firebase auth context from a Hono context.
 * Throws if the context is missing — indicating the route was not
 * wrapped in {@link createFirebaseAuthMiddleware}.
 *
 * @param c - The Hono request context.
 * @returns The decoded auth context.
 */
export function getFirebaseAuthContext(c: Context): FirebaseAuthContext {
  const ctx = c.get('firebaseAuth');
  if (ctx === undefined) {
    throw new Error('firebaseAuth context not set — middleware not applied');
  }
  return ctx;
}
