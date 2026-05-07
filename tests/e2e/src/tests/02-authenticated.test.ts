import { beforeAll, describe, expect, it } from 'vitest';

import { apiPost } from '../helpers/api-client.js';
import { config } from '../helpers/config.js';
import { mintIdToken } from '../helpers/firebase-admin-client.js';
import { decodeJwt } from '../helpers/jwt-decoder.js';

interface SessionResponse {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

interface CreateAccountResponse {
  did: string;
  handle: string;
  displayName: string;
}

interface ErrorResponse {
  error: { code: string; message: string };
}

const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;

// A well-formed but invalid JWT (HMAC-signed with a different key); used to
// verify the PDS rejects bad-signature tokens with 401 rather than 200/500.
// Source: jwt.io's classic example.
const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('Layer 2 — Authenticated read flows', () => {
  let idToken: string;

  beforeAll(async () => {
    idToken = await mintIdToken(config.testUserUid);
  }, 30000);

  it('getSession with valid Bearer returns session with both JWTs', async () => {
    const res = await apiPost<SessionResponse>('/v1/atproto/getSession', null, { idToken });
    expect(res.status).toBe(200);
    expect(res.body.did).toBe(config.testUserDid);
    expect(res.body.handle).toBe(config.testUserHandle);
    expect(res.body.accessJwt).toMatch(JWT_SHAPE);
    expect(res.body.refreshJwt).toMatch(JWT_SHAPE);
  });

  it('accessJwt has expected scope, sub, aud, exp claims', async () => {
    const res = await apiPost<SessionResponse>('/v1/atproto/getSession', null, { idToken });
    expect(res.status).toBe(200);
    const { payload } = decodeJwt(res.body.accessJwt);
    expect(payload.scope).toBe('com.atproto.access');
    expect(payload.sub).toBe(config.testUserDid);
    // aud is the PDS DID (did:web:pds.dev.fuzex.social or did:web:pds.fuzex.social)
    expect(typeof payload.aud).toBe('string');
    expect(payload.aud).toMatch(/^did:web:pds\.(dev\.)?fuzex\.social$/);
    expect(typeof payload.exp).toBe('number');
    expect(payload.exp as number).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('refreshJwt has expected scope, sub, jti claims', async () => {
    const res = await apiPost<SessionResponse>('/v1/atproto/getSession', null, { idToken });
    expect(res.status).toBe(200);
    const { payload } = decodeJwt(res.body.refreshJwt);
    expect(payload.scope).toBe('com.atproto.refresh');
    expect(payload.sub).toBe(config.testUserDid);
    expect(typeof payload.jti).toBe('string');
    expect((payload.jti as string).length).toBeGreaterThan(0);
  });

  it('getSession with no Authorization header returns 401', async () => {
    const res = await apiPost<ErrorResponse>('/v1/atproto/getSession', null);
    expect(res.status).toBe(401);
  });

  it('getSession with malformed Bearer token returns 401', async () => {
    const res = await apiPost<ErrorResponse>('/v1/atproto/getSession', null, {
      idToken: 'not-a-real-token',
    });
    expect(res.status).toBe(401);
  });

  it('getSession with valid-shape but bad-signature JWT returns 401', async () => {
    const res = await apiPost<ErrorResponse>('/v1/atproto/getSession', null, {
      idToken: FAKE_JWT,
    });
    expect(res.status).toBe(401);
  });

  it('createAccount with no Authorization header returns 401', async () => {
    const res = await apiPost<ErrorResponse>('/v1/atproto/createAccount', null);
    expect(res.status).toBe(401);
  });

  it('createAccount with valid Bearer for existing user is idempotent', async () => {
    // The endpoint always returns 201 (per createAccountService.ts: c.json(body,
    // HTTP_STATUS.CREATED) on both fresh-create and idempotent paths). Existing
    // users get back their existing DID/handle without a new PDS account.
    const res = await apiPost<CreateAccountResponse>('/v1/atproto/createAccount', null, {
      idToken,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.did).toBe(config.testUserDid);
    expect(res.body.handle).toBe(config.testUserHandle);
    expect(typeof res.body.displayName).toBe('string');
  });
});
