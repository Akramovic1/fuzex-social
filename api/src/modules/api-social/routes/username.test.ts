import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UsersRepository } from '@/shared/db/repositories/index.js';
import { buildAppHarness, type AppHarness } from '@/shared/testing/appHarness.js';
import { truncateAll } from '@/shared/testing/testDb.js';

const SEED_USER = {
  firebaseUid: 'firebase-username-test',
  username: 'akram',
  handle: 'akram.dev.fuzex.app',
  did: 'did:plc:cwbqnunxsu7isx4vv4zul4un',
  walletAddress: '0x0000000000000000000000000000000000000001',
} as const;

describe('GET /v1/username/check', () => {
  let harness: AppHarness;
  let repo: UsersRepository;

  beforeAll(async () => {
    harness = await buildAppHarness();
    repo = new UsersRepository(harness.testDb.db);
  });

  beforeEach(async () => {
    await truncateAll(harness.testDb.db);
  });

  afterAll(async () => {
    await harness.close();
  });

  it('returns 200 + available:true for a free, valid username', async () => {
    const res = await request(harness.handler).get('/v1/username/check?username=valid-name');
    expect(res.status).toBe(200);
    const body = res.body as { username: string; available: boolean; reason: string | null };
    expect(body.available).toBe(true);
    expect(body.username).toBe('valid-name');
    expect(body.reason).toBeNull();
  });

  it('returns available:false reason ALREADY_TAKEN when the username exists', async () => {
    await repo.insert(SEED_USER);
    const res = await request(harness.handler).get('/v1/username/check?username=akram');
    expect(res.status).toBe(200);
    const body = res.body as { available: boolean; reason: string };
    expect(body.available).toBe(false);
    expect(body.reason).toBe('ALREADY_TAKEN');
  });

  it('returns available:false reason RESERVED for reserved names', async () => {
    const res = await request(harness.handler).get('/v1/username/check?username=admin');
    expect(res.status).toBe(200);
    const body = res.body as { available: boolean; reason: string };
    expect(body.available).toBe(false);
    expect(body.reason).toBe('RESERVED');
  });

  it('returns available:false with the specific format-failure reason', async () => {
    const res = await request(harness.handler).get('/v1/username/check?username=ab');
    expect(res.status).toBe(200);
    const body = res.body as { available: boolean; reason: string };
    expect(body.available).toBe(false);
    expect(body.reason).toBe('TOO_SHORT');
  });

  it('returns 400 when the username query parameter is missing', async () => {
    const res = await request(harness.handler).get('/v1/username/check');
    expect(res.status).toBe(400);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects all-uppercase usernames with UPPERCASE_NOT_ALLOWED', async () => {
    const res = await request(harness.handler).get('/v1/username/check?username=BADNAME');
    expect(res.status).toBe(200);
    const body = res.body as { username: string; available: boolean; reason: string };
    expect(body.available).toBe(false);
    expect(body.reason).toBe('UPPERCASE_NOT_ALLOWED');
    // Echo the original input back, NOT a lowercased mutation.
    expect(body.username).toBe('BADNAME');
  });

  it('rejects mixed-case usernames with UPPERCASE_NOT_ALLOWED', async () => {
    const res = await request(harness.handler).get('/v1/username/check?username=Mixed');
    expect(res.status).toBe(200);
    const body = res.body as { username: string; available: boolean; reason: string };
    expect(body.available).toBe(false);
    expect(body.reason).toBe('UPPERCASE_NOT_ALLOWED');
    expect(body.username).toBe('Mixed');
  });

  it('rejects single-uppercase-letter usernames with UPPERCASE_NOT_ALLOWED', async () => {
    const res = await request(harness.handler).get('/v1/username/check?username=akrAm');
    expect(res.status).toBe(200);
    const body = res.body as { username: string; available: boolean; reason: string };
    expect(body.available).toBe(false);
    expect(body.reason).toBe('UPPERCASE_NOT_ALLOWED');
    expect(body.username).toBe('akrAm');
  });
});
