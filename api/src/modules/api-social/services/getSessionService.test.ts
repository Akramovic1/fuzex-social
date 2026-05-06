import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { UsersRepository } from '@/shared/db/repositories/index.js';
import { BadRequestError, NotFoundError } from '@/shared/errors/index.js';
import { createTestDb, truncateAll, type TestDbHandle } from '@/shared/testing/testDb.js';
import { encrypt } from '@/shared/utils/encryption.js';

import { type PdsAdminClient } from '../lib/pdsAdminClient.js';

import { GetSessionService } from './getSessionService.js';

function buildMockPdsClient(overrides: Partial<{ createSession: jest.Mock }> = {}): PdsAdminClient {
  const client = {
    createSession:
      overrides.createSession ??
      jest.fn(async (handle: string) => ({
        did: 'did:plc:test1',
        handle,
        accessJwt: 'access-jwt',
        refreshJwt: 'refresh-jwt',
      })),
  };
  return client as unknown as PdsAdminClient;
}

describe('GetSessionService', () => {
  let dbHandle: TestDbHandle;
  let usersRepo: UsersRepository;

  beforeEach(async () => {
    dbHandle = createTestDb();
    usersRepo = new UsersRepository(dbHandle.db);
    await truncateAll(dbHandle.db);
  });

  afterEach(async () => {
    await dbHandle.close();
  });

  it('issues a fresh PDS session for an existing user', async () => {
    await usersRepo.createWithProfile({
      firebaseUid: 'firebase-uid-1',
      username: 'akram',
      handle: 'akram.dev.fuzex.app',
      did: 'did:plc:test1',
      walletAddress: '0x0000000000000000000000000000000000000001',
      chain: 'ethereum',
      email: 'akram@example.com',
      phoneNumber: null,
      authProvider: 'password',
      emailVerified: true,
      phoneVerified: false,
      displayName: 'Akram',
      dateOfBirth: '1990-01-01',
      gender: 'male',
      countryCode: null,
      locale: 'en',
      pdsPasswordEncrypted: encrypt('strong-pds-password'),
    });

    const pds = buildMockPdsClient();
    const svc = new GetSessionService(usersRepo, pds);

    const result = await svc.execute({ firebaseUid: 'firebase-uid-1' });
    expect(result.did).toBe('did:plc:test1');
    expect(result.handle).toBe('akram.dev.fuzex.app');
    expect(result.accessJwt).toBe('access-jwt');
  });

  it('throws NotFoundError when no user matches the firebase_uid', async () => {
    const svc = new GetSessionService(usersRepo, buildMockPdsClient());

    await expect(svc.execute({ firebaseUid: 'unknown-uid' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws BadRequestError when the user has no encrypted PDS password', async () => {
    await usersRepo.insert({
      firebaseUid: 'legacy-uid',
      username: 'legacy',
      handle: 'legacy.dev.fuzex.app',
      did: 'did:plc:legacy',
      walletAddress: '0x000000000000000000000000000000000000abcd',
      chain: 'ethereum',
    });

    const svc = new GetSessionService(usersRepo, buildMockPdsClient());

    await expect(svc.execute({ firebaseUid: 'legacy-uid' })).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });

  it('bubbles up errors from PDS createSession', async () => {
    await usersRepo.createWithProfile({
      firebaseUid: 'firebase-uid-2',
      username: 'sara',
      handle: 'sara.dev.fuzex.app',
      did: 'did:plc:sara',
      walletAddress: '0x000000000000000000000000000000000000fff1',
      chain: 'ethereum',
      email: 'sara@example.com',
      phoneNumber: null,
      authProvider: 'password',
      emailVerified: true,
      phoneVerified: false,
      displayName: 'Sara',
      dateOfBirth: '1995-01-01',
      gender: 'female',
      countryCode: null,
      locale: 'en',
      pdsPasswordEncrypted: encrypt('pwd'),
    });

    const pds = buildMockPdsClient({
      createSession: jest.fn(async () => {
        throw new Error('PDS createSession failed: 502');
      }),
    });
    const svc = new GetSessionService(usersRepo, pds);

    await expect(svc.execute({ firebaseUid: 'firebase-uid-2' })).rejects.toThrow(
      /PDS createSession failed/,
    );
  });
});
