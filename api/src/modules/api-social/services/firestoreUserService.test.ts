import { describe, expect, it } from '@jest/globals';
import { type Firestore } from 'firebase-admin/firestore';

import { BadRequestError, NotFoundError } from '@/shared/errors/index.js';

import { FirestoreUserService } from './firestoreUserService.js';

interface FakeDoc {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

interface FakeStore {
  Users: Map<string, Record<string, unknown>>;
}

function buildFakeFirestore(store: FakeStore): Firestore {
  const collection = (name: string) => {
    if (name !== 'Users') {
      throw new Error(`unexpected collection: ${name}`);
    }
    return {
      doc: (uid: string) => ({
        get: async (): Promise<FakeDoc> => {
          const data = store.Users.get(uid);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
      }),
    };
  };
  return { collection } as unknown as Firestore;
}

const VALID_USER = {
  walletAddress: '0x0000000000000000000000000000000000000001',
  username: 'akram',
  displayName: 'Akram',
  dateOfBirth: '1990-01-01',
  gender: 'male',
};

describe('FirestoreUserService.fetchUser', () => {
  it('returns parsed data when the doc exists with valid fields', async () => {
    const store: FakeStore = { Users: new Map([['uid-1', VALID_USER]]) };
    const svc = new FirestoreUserService(buildFakeFirestore(store), {
      sleep: async () => undefined,
    });

    const user = await svc.fetchUser('uid-1');
    expect(user.username).toBe('akram');
    expect(user.gender).toBe('male');
  });

  it('retries on missing doc and resolves once it appears', async () => {
    let callCount = 0;
    const firestore: Firestore = {
      collection: () => ({
        doc: () => ({
          get: async (): Promise<FakeDoc> => {
            callCount += 1;
            if (callCount >= 3) {
              return { exists: true, data: () => VALID_USER };
            }
            return { exists: false, data: () => undefined };
          },
        }),
      }),
    } as unknown as Firestore;

    const svc = new FirestoreUserService(firestore, { sleep: async () => undefined });
    const user = await svc.fetchUser('uid-1');
    expect(user.username).toBe('akram');
    expect(callCount).toBe(3);
  });

  it('throws NotFoundError after retries exhausted', async () => {
    const firestore = buildFakeFirestore({ Users: new Map() });
    const svc = new FirestoreUserService(firestore, { sleep: async () => undefined });

    await expect(svc.fetchUser('missing-uid')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws BadRequestError when the doc has invalid wallet address', async () => {
    const store: FakeStore = {
      Users: new Map([['uid-1', { ...VALID_USER, walletAddress: 'not-a-wallet' }]]),
    };
    const svc = new FirestoreUserService(buildFakeFirestore(store), {
      sleep: async () => undefined,
    });

    await expect(svc.fetchUser('uid-1')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when the doc has invalid gender value', async () => {
    const store: FakeStore = {
      Users: new Map([['uid-1', { ...VALID_USER, gender: 'unknown' }]]),
    };
    const svc = new FirestoreUserService(buildFakeFirestore(store), {
      sleep: async () => undefined,
    });

    await expect(svc.fetchUser('uid-1')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when a required field is missing', async () => {
    const store: FakeStore = {
      Users: new Map([['uid-1', { ...VALID_USER, displayName: undefined }]]),
    };
    const svc = new FirestoreUserService(buildFakeFirestore(store), {
      sleep: async () => undefined,
    });

    await expect(svc.fetchUser('uid-1')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when the doc has an uppercase username', async () => {
    // The mobile/wallet pipeline must write usernames lowercased. If the doc
    // arrives with uppercase letters (e.g. "AKRAM"), fuzex-api must reject —
    // we never silently lowercase user input. The Firestore zod schema's
    // `^[a-z0-9-]+$` regex enforces this at the parse boundary.
    const store: FakeStore = {
      Users: new Map([['uid-1', { ...VALID_USER, username: 'AKRAM' }]]),
    };
    const svc = new FirestoreUserService(buildFakeFirestore(store), {
      sleep: async () => undefined,
    });

    await expect(svc.fetchUser('uid-1')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when the doc has a mixed-case username', async () => {
    const store: FakeStore = {
      Users: new Map([['uid-1', { ...VALID_USER, username: 'Akram' }]]),
    };
    const svc = new FirestoreUserService(buildFakeFirestore(store), {
      sleep: async () => undefined,
    });

    await expect(svc.fetchUser('uid-1')).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('FirestoreUserService.isOldEnough', () => {
  it('returns true for a date exactly 13 years ago', () => {
    const svc = new FirestoreUserService({} as Firestore);
    const thirteenYearsAgo = new Date();
    thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 14);
    const dob = thirteenYearsAgo.toISOString().slice(0, 10);
    expect(svc.isOldEnough(dob)).toBe(true);
  });

  it('returns false for a date within the last 12 years', () => {
    const svc = new FirestoreUserService({} as Firestore);
    const elevenYearsAgo = new Date();
    elevenYearsAgo.setFullYear(elevenYearsAgo.getFullYear() - 11);
    const dob = elevenYearsAgo.toISOString().slice(0, 10);
    expect(svc.isOldEnough(dob)).toBe(false);
  });
});
