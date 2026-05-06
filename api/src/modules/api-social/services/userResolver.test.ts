import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

import { UsersRepository } from '@/shared/db/repositories/index.js';
import { HandleResolutionError } from '@/shared/errors/index.js';
import { createTestDb, truncateAll, type TestDbHandle } from '@/shared/testing/testDb.js';

import { UserResolver } from './userResolver.js';

const HANDLE_DOMAIN = '.dev.fuzex.social';

const SEED_USER = {
  firebaseUid: 'firebase_test_user_1',
  username: 'akram',
  handle: 'akram.dev.fuzex.social',
  did: 'did:plc:cwbqnunxsu7isx4vv4zul4un',
  walletAddress: '0x0000000000000000000000000000000000000001',
} as const;

describe('UserResolver', () => {
  let dbHandle: TestDbHandle;
  let repo: UsersRepository;
  let resolver: UserResolver;

  beforeAll(() => {
    dbHandle = createTestDb();
    repo = new UsersRepository(dbHandle.db);
    resolver = new UserResolver({ usersRepository: repo, handleDomain: HANDLE_DOMAIN });
  });

  beforeEach(async () => {
    await truncateAll(dbHandle.db);
  });

  afterAll(async () => {
    await dbHandle.close();
  });

  describe('resolveHostToDid', () => {
    it('returns the DID for a valid handle', async () => {
      await repo.insert(SEED_USER);
      const did = await resolver.resolveHostToDid('akram.dev.fuzex.social');
      expect(did).toBe(SEED_USER.did);
    });

    it('strips a port suffix from the host', async () => {
      await repo.insert(SEED_USER);
      const did = await resolver.resolveHostToDid('akram.dev.fuzex.social:443');
      expect(did).toBe(SEED_USER.did);
    });

    it('throws USER_NOT_FOUND for an unknown handle', async () => {
      await expect(resolver.resolveHostToDid('nope.dev.fuzex.social')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });

    it('throws INVALID_HANDLE for a malformed host', async () => {
      await expect(resolver.resolveHostToDid('not-our-domain.com')).rejects.toMatchObject({
        code: 'INVALID_HANDLE',
      });
    });

    it('throws INVALID_HANDLE for nested subdomains', async () => {
      await expect(resolver.resolveHostToDid('evil.akram.dev.fuzex.social')).rejects.toMatchObject({
        code: 'INVALID_HANDLE',
      });
    });

    it('treats reserved usernames as not found', async () => {
      await expect(resolver.resolveHostToDid('admin.dev.fuzex.social')).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
      });
    });
  });

  describe('resolveHandleForTipping', () => {
    it('returns the public summary for a valid handle', async () => {
      await repo.insert(SEED_USER);
      const summary = await resolver.resolveHandleForTipping('akram.dev.fuzex.social');
      expect(summary).toEqual({
        handle: 'akram.dev.fuzex.social',
        did: SEED_USER.did,
        walletAddress: SEED_USER.walletAddress,
        chain: 'ethereum',
        tippingEnabled: true,
      });
    });

    it('throws TIPPING_DISABLED when tippingEnabled=false', async () => {
      await repo.insert({ ...SEED_USER, tippingEnabled: false });
      await expect(
        resolver.resolveHandleForTipping('akram.dev.fuzex.social'),
      ).rejects.toMatchObject({
        code: 'TIPPING_DISABLED',
      });
    });

    it('throws USER_NOT_FOUND for an unknown handle', async () => {
      await expect(resolver.resolveHandleForTipping('nope.dev.fuzex.social')).rejects.toMatchObject(
        {
          code: 'USER_NOT_FOUND',
        },
      );
    });

    it('throws INVALID_HANDLE for a username with invalid format', async () => {
      // 'a' alone is too short
      await expect(resolver.resolveHandleForTipping('a.dev.fuzex.social')).rejects.toMatchObject({
        code: 'INVALID_HANDLE',
      });
    });

    it('throws HandleResolutionError instances', async () => {
      await expect(resolver.resolveHandleForTipping('a.dev.fuzex.social')).rejects.toBeInstanceOf(
        HandleResolutionError,
      );
    });
  });
});
