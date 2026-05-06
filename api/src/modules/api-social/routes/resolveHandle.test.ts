import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UsersRepository } from '@/shared/db/repositories/index.js';
import { buildAppHarness, type AppHarness } from '@/shared/testing/appHarness.js';
import { truncateAll } from '@/shared/testing/testDb.js';

import { errorResponseSchema, resolveHandleResponseSchema } from '../schemas/responses.js';

const SEED_USER = {
  firebaseUid: 'firebase_test_user_1',
  username: 'akram',
  handle: 'akram.dev.fuzex.app',
  did: 'did:plc:cwbqnunxsu7isx4vv4zul4un',
  walletAddress: '0x0000000000000000000000000000000000000001',
} as const;

describe('GET /v1/resolve/:handle', () => {
  let harness: AppHarness;
  let repo: UsersRepository;

  beforeAll(async () => {
    harness = await buildAppHarness();
    repo = new UsersRepository(harness.testDb.db);
  });

  beforeEach(async () => {
    await truncateAll(harness.testDb.db);
  });

  afterEach(async () => {
    await truncateAll(harness.testDb.db);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('returns the public summary for a valid handle', async () => {
    await repo.insert(SEED_USER);

    const res = await request(harness.handler).get('/v1/resolve/akram.dev.fuzex.app');

    expect(res.status).toBe(200);
    const parsed = resolveHandleResponseSchema.parse(res.body);
    expect(parsed).toEqual({
      handle: 'akram.dev.fuzex.app',
      did: SEED_USER.did,
      walletAddress: SEED_USER.walletAddress,
      chain: 'ethereum',
      tippingEnabled: true,
    });
  });

  it('sets cache-control on success', async () => {
    await repo.insert(SEED_USER);

    const res = await request(harness.handler).get('/v1/resolve/akram.dev.fuzex.app');
    expect(res.headers['cache-control']).toBe('public, max-age=60');
  });

  it('returns 404 with USER_NOT_FOUND for unknown handles', async () => {
    const res = await request(harness.handler).get('/v1/resolve/unknown.dev.fuzex.app');

    expect(res.status).toBe(404);
    const body = errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });

  it('returns 400 with INVALID_HANDLE for malformed handles', async () => {
    const res = await request(harness.handler).get('/v1/resolve/not-our-domain.com');

    expect(res.status).toBe(400);
    const body = errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('INVALID_HANDLE');
  });

  it('returns 404 with TIPPING_DISABLED when tipping is off', async () => {
    await repo.insert({ ...SEED_USER, tippingEnabled: false });

    const res = await request(harness.handler).get('/v1/resolve/akram.dev.fuzex.app');

    expect(res.status).toBe(404);
    const body = errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('TIPPING_DISABLED');
  });

  it('returns 400 for handles with invalid username format', async () => {
    // 'a' is too short
    const res = await request(harness.handler).get('/v1/resolve/a.dev.fuzex.app');

    expect(res.status).toBe(400);
    const body = errorResponseSchema.parse(res.body);
    expect(body.error.code).toBe('INVALID_HANDLE');
  });
});
