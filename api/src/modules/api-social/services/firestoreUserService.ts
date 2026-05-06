import { type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';

import { config } from '@/shared/config/index.js';
import { BadRequestError, NotFoundError } from '@/shared/errors/index.js';
import { getFirestoreClient } from '@/shared/firebase/firebaseAdmin.js';
import { logger } from '@/shared/logger/index.js';

const FIRESTORE_USERS_COLLECTION = 'Users';
const RETRY_DELAYS_MS: readonly number[] = [300, 600, 900];

export const firestoreUserSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'walletAddress must be a 0x-prefixed 40-char hex string'),
  username: z
    .string()
    .min(3, 'username must be at least 3 characters')
    .max(20, 'username must be at most 20 characters')
    .regex(/^[a-z0-9-]+$/, 'username may only contain lowercase letters, digits, and hyphens'),
  displayName: z.string().min(1).max(64),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be ISO YYYY-MM-DD'),
  gender: z.enum(['female', 'male', 'prefer_not_to_say']),
});

export type FirestoreUser = z.infer<typeof firestoreUserSchema>;

interface FirestoreUserServiceOptions {
  /** Optional sleep override for tests so retries don't actually wait. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Reads + validates the Firestore `Users/{firebaseUid}` document.
 *
 * Mobile may write Firestore in parallel with calling fuzex-api; we therefore
 * retry the read up to 3 times with a short backoff (300 / 600 / 900 ms) before
 * surfacing NotFoundError.
 */
export class FirestoreUserService {
  private readonly firestore: Firestore;
  private readonly sleep: (ms: number) => Promise<void>;

  public constructor(
    firestore: Firestore = getFirestoreClient(),
    options: FirestoreUserServiceOptions = {},
  ) {
    this.firestore = firestore;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * Fetches and validates the user doc for `firebaseUid`.
   *
   * @param firebaseUid - The Firebase UID acting as the doc id.
   * @returns Parsed FirestoreUser on success.
   * @throws NotFoundError - If the doc is still missing after retries.
   * @throws BadRequestError - If the doc exists but fails validation.
   */
  public async fetchUser(firebaseUid: string): Promise<FirestoreUser> {
    const docRef = this.firestore.collection(FIRESTORE_USERS_COLLECTION).doc(firebaseUid);

    let snapshot = await docRef.get();
    for (let attempt = 0; !snapshot.exists && attempt < RETRY_DELAYS_MS.length; attempt += 1) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined) {
        await this.sleep(delay);
      }
      snapshot = await docRef.get();
    }

    if (!snapshot.exists) {
      throw new NotFoundError(
        'user data not found in Firestore — make sure the mobile app wrote Users/{uid} before calling',
        { firebaseUid },
      );
    }

    const raw = snapshot.data();
    const parsed = firestoreUserSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn(
        { firebaseUid, errors: parsed.error.flatten() },
        'firestore user doc failed validation',
      );
      throw new BadRequestError(
        `firestore user doc invalid: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
        { firebaseUid },
      );
    }

    return parsed.data;
  }

  /**
   * Returns true if the user is at least MIN_USER_AGE years old as of today.
   *
   * @param dateOfBirth - ISO YYYY-MM-DD (validated upstream).
   * @returns Whether the user meets the minimum age.
   */
  public isOldEnough(dateOfBirth: string): boolean {
    const dob = new Date(`${dateOfBirth}T00:00:00Z`);
    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (365.25 * 24 * 3600 * 1000);
    return ageYears >= config.env.MIN_USER_AGE;
  }
}
