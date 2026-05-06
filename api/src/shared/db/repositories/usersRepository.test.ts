import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb, truncateAll } from '@/shared/testing/testDb.js';

import { UsersRepository } from './usersRepository.js';

const SEED_USER = {
  firebaseUid: 'firebase_test_user_1',
  username: 'akram',
  handle: 'akram.dev.fuzex.app',
  did: 'did:plc:cwbqnunxsu7isx4vv4zul4un',
  walletAddress: '0x0000000000000000000000000000000000000001',
} as const;

describe('UsersRepository', () => {
  const handle = createTestDb();
  const repo = new UsersRepository(handle.db);

  beforeEach(async () => {
    await truncateAll(handle.db);
  });

  afterAll(async () => {
    await handle.close();
  });

  describe('insert', () => {
    it('inserts a user and returns the row with generated id and timestamps', async () => {
      const inserted = await repo.insert(SEED_USER);
      expect(inserted.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(inserted.username).toBe('akram');
      expect(inserted.chain).toBe('ethereum');
      expect(inserted.tippingEnabled).toBe(true);
      expect(inserted.createdAt).toBeInstanceOf(Date);
      expect(inserted.updatedAt).toBeInstanceOf(Date);
    });

    it('rejects duplicate usernames', async () => {
      await repo.insert(SEED_USER);
      await expect(
        repo.insert({
          ...SEED_USER,
          firebaseUid: 'firebase_test_user_2',
          handle: 'akram2.dev.fuzex.app',
          did: 'did:plc:differentdid000000000000000',
        }),
      ).rejects.toThrow(/username/);
    });
  });

  describe('findByUsername', () => {
    it('returns the user when found', async () => {
      await repo.insert(SEED_USER);
      const found = await repo.findByUsername('akram');
      expect(found).not.toBeNull();
      expect(found?.handle).toBe('akram.dev.fuzex.app');
    });

    it('returns null when not found', async () => {
      const found = await repo.findByUsername('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('findByHandle', () => {
    it('returns the user when found', async () => {
      await repo.insert(SEED_USER);
      const found = await repo.findByHandle('akram.dev.fuzex.app');
      expect(found?.username).toBe('akram');
    });

    it('returns null when not found', async () => {
      const found = await repo.findByHandle('nope.dev.fuzex.app');
      expect(found).toBeNull();
    });
  });

  describe('findByFirebaseUid', () => {
    it('returns the user when found', async () => {
      await repo.insert(SEED_USER);
      const found = await repo.findByFirebaseUid('firebase_test_user_1');
      expect(found?.username).toBe('akram');
    });
  });

  describe('findByDid', () => {
    it('returns the user when found', async () => {
      await repo.insert(SEED_USER);
      const found = await repo.findByDid('did:plc:cwbqnunxsu7isx4vv4zul4un');
      expect(found?.username).toBe('akram');
    });
  });
});
