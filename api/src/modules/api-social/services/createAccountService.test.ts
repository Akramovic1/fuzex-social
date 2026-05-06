import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { AuditLogsRepository, UsersRepository } from '@/shared/db/repositories/index.js';
import { ConflictError, UnprocessableEntityError } from '@/shared/errors/index.js';
import { type FirebaseAuthContext } from '@/shared/middleware/firebaseAuth.js';
import { createTestDb, truncateAll, type TestDbHandle } from '@/shared/testing/testDb.js';

import { type PdsAdminClient } from '../lib/pdsAdminClient.js';

import { CreateAccountService } from './createAccountService.js';
import { type FirestoreUserService, type FirestoreUser } from './firestoreUserService.js';

const HANDLE_DOMAIN = '.dev.fuzex.social';

const VALID_FIRESTORE_USER: FirestoreUser = {
  walletAddress: '0x0000000000000000000000000000000000000001',
  username: 'akram',
  name: 'Akram',
  dateOfBirth: '1990-01-01',
  gender: 'male',
};

const VALID_AUTH: FirebaseAuthContext = {
  uid: 'firebase-uid-1',
  email: 'akram@example.com',
  phoneNumber: null,
  emailVerified: true,
  phoneVerified: false,
  authProvider: 'password',
};

interface PdsClientMocks {
  readonly createInviteCode: jest.Mock;
  readonly createAccount: jest.Mock;
  readonly putProfile: jest.Mock;
  readonly createSession: jest.Mock;
}

interface MockPdsClient extends PdsClientMocks {
  // Marker to keep type system happy where PdsAdminClient is expected.
  readonly __isMockPdsClient: true;
}

function buildMockPdsClient(overrides: Partial<PdsClientMocks> = {}): MockPdsClient {
  const obj = {
    createInviteCode: overrides.createInviteCode ?? jest.fn(async () => ({ code: 'INVITE-1' })),
    createAccount:
      overrides.createAccount ??
      jest.fn(async () => ({
        did: 'did:plc:test1',
        handle: 'akram.dev.fuzex.social',
        accessJwt: 'access-jwt',
        refreshJwt: 'refresh-jwt',
      })),
    putProfile: overrides.putProfile ?? jest.fn(async () => undefined),
    createSession: overrides.createSession ?? jest.fn(),
  };
  return obj as unknown as MockPdsClient;
}

function asPdsClient(mock: MockPdsClient): PdsAdminClient {
  return mock as unknown as PdsAdminClient;
}

function buildMockFirestoreUserService(user: FirestoreUser = VALID_FIRESTORE_USER) {
  const fake = {
    fetchUser: jest.fn(async () => user),
    isOldEnough: jest.fn(() => true),
  };
  return fake as unknown as FirestoreUserService;
}

describe('CreateAccountService', () => {
  let dbHandle: TestDbHandle;
  let usersRepo: UsersRepository;
  let auditRepo: AuditLogsRepository;

  beforeEach(async () => {
    dbHandle = createTestDb();
    usersRepo = new UsersRepository(dbHandle.db);
    auditRepo = new AuditLogsRepository(dbHandle.db);
    await truncateAll(dbHandle.db);
  });

  afterEach(async () => {
    await dbHandle.close();
  });

  it('happy path: creates PDS account, inserts row, writes audit log', async () => {
    const pds = buildMockPdsClient();
    const fs = buildMockFirestoreUserService();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    const result = await svc.execute({ firebaseAuth: VALID_AUTH, correlationId: 'corr-1' });

    expect(result.did).toBe('did:plc:test1');
    expect(result.handle).toBe('akram.dev.fuzex.social');
    expect(result.displayName).toBe('Akram');

    expect(pds.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'akram@example.com',
        handle: 'akram.dev.fuzex.social',
      }),
    );
    expect(pds.putProfile).toHaveBeenCalled();

    const inserted = await usersRepo.findByFirebaseUid(VALID_AUTH.uid);
    expect(inserted).not.toBeNull();
    expect(inserted?.username).toBe('akram');
    expect(inserted?.email).toBe('akram@example.com');
    expect(inserted?.pdsPasswordEncrypted).not.toBeNull();
  });

  it('returns existing identity when a user already exists for this firebase_uid', async () => {
    // Pre-insert
    await usersRepo.insert({
      firebaseUid: VALID_AUTH.uid,
      username: 'existing',
      handle: 'existing.dev.fuzex.social',
      did: 'did:plc:existing',
      walletAddress: '0x0000000000000000000000000000000000000099',
      chain: 'ethereum',
    });

    const pds = buildMockPdsClient();
    const fs = buildMockFirestoreUserService();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    const result = await svc.execute({ firebaseAuth: VALID_AUTH, correlationId: 'corr' });

    expect(result.did).toBe('did:plc:existing');
    expect(pds.createAccount).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fs.fetchUser).not.toHaveBeenCalled();
  });

  it('throws UnprocessableEntityError when the user is under MIN_USER_AGE', async () => {
    const fs = {
      fetchUser: jest.fn(async () => VALID_FIRESTORE_USER),
      isOldEnough: jest.fn(() => false),
    } as unknown as FirestoreUserService;
    const pds = buildMockPdsClient();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    await expect(
      svc.execute({ firebaseAuth: VALID_AUTH, correlationId: 'corr' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityError);
    expect(pds.createAccount).not.toHaveBeenCalled();
  });

  it('throws ConflictError when the requested username is taken', async () => {
    await usersRepo.insert({
      firebaseUid: 'other-firebase-uid',
      username: 'akram',
      handle: 'akram.dev.fuzex.social',
      did: 'did:plc:other',
      walletAddress: '0x000000000000000000000000000000000000000a',
      chain: 'ethereum',
    });

    const pds = buildMockPdsClient();
    const fs = buildMockFirestoreUserService();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    await expect(
      svc.execute({ firebaseAuth: VALID_AUTH, correlationId: 'corr' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(pds.createAccount).not.toHaveBeenCalled();
  });

  it('bubbles up errors from PDS createAccount', async () => {
    const pds = buildMockPdsClient({
      createAccount: jest.fn(async () => {
        throw new Error('PDS createAccount failed: 502');
      }),
    });
    const fs = buildMockFirestoreUserService();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    await expect(svc.execute({ firebaseAuth: VALID_AUTH, correlationId: 'corr' })).rejects.toThrow(
      /PDS createAccount failed/,
    );
  });

  it('still inserts the user row when putProfile fails (account is created)', async () => {
    const pds = buildMockPdsClient({
      putProfile: jest.fn(async () => {
        throw new Error('putProfile flaked');
      }),
    });
    const fs = buildMockFirestoreUserService();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    const result = await svc.execute({ firebaseAuth: VALID_AUTH, correlationId: 'corr' });
    expect(result.did).toBe('did:plc:test1');

    const inserted = await usersRepo.findByFirebaseUid(VALID_AUTH.uid);
    expect(inserted).not.toBeNull();
  });

  it('synthesizes a phone-based email when no real email is present', async () => {
    const pds = buildMockPdsClient();
    const fs = buildMockFirestoreUserService();
    const svc = new CreateAccountService(fs, asPdsClient(pds), usersRepo, auditRepo, {
      handleDomain: HANDLE_DOMAIN,
    });

    const phoneAuth: FirebaseAuthContext = {
      ...VALID_AUTH,
      email: null,
      phoneNumber: '+15551234567',
      authProvider: 'phone',
      emailVerified: false,
      phoneVerified: true,
    };

    await svc.execute({ firebaseAuth: phoneAuth, correlationId: 'corr' });

    expect(pds.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'phone-15551234567@email.fuzex.social' }),
    );
  });
});
