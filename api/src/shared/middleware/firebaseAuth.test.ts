import { describe, expect, it, jest } from '@jest/globals';
import { type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { Hono } from 'hono';

import { registerErrorHandler } from './errorHandler.js';
import { createFirebaseAuthMiddleware } from './firebaseAuth.js';

const VALID_TOKEN = 'valid-token';

function buildFakeAuth(decoded: Partial<DecodedIdToken> = {}): Auth {
  const verifyIdToken = jest.fn(async (token: string) => {
    if (token !== VALID_TOKEN) {
      throw new Error('invalid token');
    }
    return {
      uid: 'firebase-uid-1',
      email: 'akram@example.com',
      email_verified: true,
      ...decoded,
    } as DecodedIdToken;
  });
  return { verifyIdToken } as unknown as Auth;
}

function buildAppWithMiddleware(auth: Auth): Hono {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('correlationId', 'test-corr');
    c.set('requestStartedAt', Date.now());
    await next();
  });
  app.use(
    '*',
    createFirebaseAuthMiddleware(() => auth),
  );
  app.get('/me', (c) => {
    const ctx = c.get('firebaseAuth');
    return c.json(ctx ?? { error: 'no ctx' });
  });
  registerErrorHandler(app);
  return app;
}

describe('createFirebaseAuthMiddleware', () => {
  it('attaches a populated context for a valid token', async () => {
    const app = buildAppWithMiddleware(buildFakeAuth());
    const res = await app.request('/me', {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.uid).toBe('firebase-uid-1');
    expect(body.email).toBe('akram@example.com');
    expect(body.emailVerified).toBe(true);
    expect(body.phoneNumber).toBeNull();
    expect(body.phoneVerified).toBe(false);
    expect(body.authProvider).toBe('unknown');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = buildAppWithMiddleware(buildFakeAuth());
    const res = await app.request('/me');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/missing Authorization header/);
  });

  it('returns 401 for non-Bearer scheme', async () => {
    const app = buildAppWithMiddleware(buildFakeAuth());
    const res = await app.request('/me', {
      headers: { Authorization: 'Basic abc' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for empty Bearer token', async () => {
    const app = buildAppWithMiddleware(buildFakeAuth());
    const res = await app.request('/me', {
      headers: { Authorization: 'Bearer    ' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an invalid token (verify throws)', async () => {
    const app = buildAppWithMiddleware(buildFakeAuth());
    const res = await app.request('/me', {
      headers: { Authorization: 'Bearer wrong-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/invalid or expired token/);
  });

  it('populates phone-only context when no email is present', async () => {
    const auth = buildFakeAuth({
      email: undefined,
      email_verified: false,
      phone_number: '+15551234567',
      firebase: {
        sign_in_provider: 'phone',
        identities: {},
      },
    });
    const app = buildAppWithMiddleware(auth);
    const res = await app.request('/me', {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.email).toBeNull();
    expect(body.phoneNumber).toBe('+15551234567');
    expect(body.phoneVerified).toBe(true);
    expect(body.authProvider).toBe('phone');
  });

  it('populates context with both email and phone null for anonymous-style tokens', async () => {
    const auth = buildFakeAuth({
      email: undefined,
      email_verified: false,
      phone_number: undefined,
    });
    const app = buildAppWithMiddleware(auth);
    const res = await app.request('/me', {
      headers: { Authorization: `Bearer ${VALID_TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.email).toBeNull();
    expect(body.phoneNumber).toBeNull();
    expect(body.emailVerified).toBe(false);
    expect(body.phoneVerified).toBe(false);
  });

  it('throws when getFirebaseAuthContext is called outside the middleware', async () => {
    const { getFirebaseAuthContext } = await import('./firebaseAuth.js');
    const fakeContext = { get: () => undefined } as unknown as Parameters<
      typeof getFirebaseAuthContext
    >[0];
    expect(() => getFirebaseAuthContext(fakeContext)).toThrow(/middleware not applied/);
  });
});
