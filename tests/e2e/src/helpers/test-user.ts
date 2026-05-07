import { randomBytes } from 'node:crypto';

import { adminAuth, adminFirestore } from './firebase-admin-client.js';
import { config } from './config.js';

export interface TestUserParams {
  readonly uid: string;
  readonly email: string;
  readonly username: string;
  readonly walletAddress: string;
  readonly name: string;
  readonly dateOfBirth: string;
  readonly gender: 'female' | 'male' | 'prefer_not_to_say';
}

/**
 * Generates a unique test user spec for Layer 3.
 *
 * - uid: `${prefix}-${shortTs}-${randomHex}` (kebab-friendly, prefix grep-able)
 * - username: `${prefix}${shortTs}${randomHex}` lowercase, ≤20 chars, alphanumeric
 *   (matches the Firestore zod schema: 3-20 chars, [a-z0-9-])
 * - walletAddress: random 0x + 40 hex chars
 */
export function generateTestUser(): TestUserParams {
  const shortTs = Date.now().toString(36).slice(-4);
  const randomHex = randomBytes(4).toString('hex');
  const uid = `${config.userPrefix}-${shortTs}-${randomHex}`;

  // Username must be ≤20 chars, [a-z0-9-]. Build from prefix + ts + hex without dashes.
  // e2e + 4 + 8 = 15 chars, safe.
  const usernameRaw = `${config.userPrefix}${shortTs}${randomHex}`.toLowerCase();
  const username = usernameRaw.slice(0, 20).replace(/[^a-z0-9-]/g, '');

  return {
    uid,
    email: `${uid}@fuzex.io`,
    username,
    walletAddress: `0x${randomBytes(20).toString('hex')}`,
    name: 'E2E Test User',
    dateOfBirth: '1990-01-01',
    gender: 'prefer_not_to_say',
  };
}

/**
 * Creates a Firebase Auth user AND writes the matching Firestore Users/{uid}
 * doc. fuzex-api's createAccount endpoint reads from this Firestore doc.
 *
 * Best-effort rollback: if Firestore write fails, the Firebase user is
 * deleted. If both fail, throws and leaves whatever state it created.
 */
export async function createTestUserInFirebase(user: TestUserParams): Promise<void> {
  await adminAuth().createUser({
    uid: user.uid,
    email: user.email,
    emailVerified: true,
    displayName: user.name,
  });

  try {
    await adminFirestore().collection('Users').doc(user.uid).set({
      walletAddress: user.walletAddress,
      username: user.username,
      name: user.name,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      email: user.email,
    });
  } catch (err) {
    // Rollback the Auth user so we don't leave orphans.
    try {
      await adminAuth().deleteUser(user.uid);
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.warn(`[test-user] rollback delete failed for uid=${user.uid}:`, cleanupErr);
    }
    throw err;
  }
}

/**
 * Best-effort cleanup of Firebase Auth user + Firestore doc.
 * Logs warnings instead of throwing — afterAll should never crash the suite.
 */
export async function deleteFirebaseAndFirestore(uid: string): Promise<void> {
  try {
    await adminFirestore().collection('Users').doc(uid).delete();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[test-user] firestore delete failed for uid=${uid}:`, err);
  }
  try {
    await adminAuth().deleteUser(uid);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[test-user] auth delete failed for uid=${uid}:`, err);
  }
}
