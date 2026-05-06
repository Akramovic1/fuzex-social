import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { UsersRepository } from '@/shared/db/repositories/index.js';
import { buildAppHarness, type AppHarness } from '@/shared/testing/appHarness.js';
import { truncateAll } from '@/shared/testing/testDb.js';

const SEED_USER = {
  firebaseUid: 'firebase_test_user_1',
  username: 'akram',
  handle: 'akram.dev.fuzex.social',
  did: 'did:plc:cwbqnunxsu7isx4vv4zul4un',
  walletAddress: '0x0000000000000000000000000000000000000001',
} as const;

describe('GET /.well-known/atproto-did', () => {
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

  it('returns the DID as plain text with no trailing newline', async () => {
    await repo.insert(SEED_USER);

    const res = await request(harness.handler)
      .get('/.well-known/atproto-did')
      .set('Host', 'akram.dev.fuzex.social');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toBe(SEED_USER.did);
    expect(res.text.endsWith('\n')).toBe(false);
    expect(Buffer.byteLength(res.text)).toBe(SEED_USER.did.length);
  });

  it('returns 404 with empty body for unknown handles', async () => {
    const res = await request(harness.handler)
      .get('/.well-known/atproto-did')
      .set('Host', 'unknown.dev.fuzex.social');

    expect(res.status).toBe(404);
    expect(res.text).toBe('');
  });

  it('returns 404 for malformed (non-matching domain) hosts', async () => {
    const res = await request(harness.handler)
      .get('/.well-known/atproto-did')
      .set('Host', 'someone.example.com');

    expect(res.status).toBe(404);
    expect(res.text).toBe('');
  });

  it('returns 404 for nested-subdomain hosts', async () => {
    await repo.insert(SEED_USER);

    const res = await request(harness.handler)
      .get('/.well-known/atproto-did')
      .set('Host', 'evil.akram.dev.fuzex.social');

    expect(res.status).toBe(404);
    expect(res.text).toBe('');
  });

  it('returns 404 for reserved usernames even if somehow seeded', async () => {
    const res = await request(harness.handler)
      .get('/.well-known/atproto-did')
      .set('Host', 'admin.dev.fuzex.social');

    expect(res.status).toBe(404);
    expect(res.text).toBe('');
  });

  it('sets cache-control on success', async () => {
    await repo.insert(SEED_USER);

    const res = await request(harness.handler)
      .get('/.well-known/atproto-did')
      .set('Host', 'akram.dev.fuzex.social');

    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });
});
