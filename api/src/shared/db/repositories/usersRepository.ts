import { eq } from 'drizzle-orm';

import { type Database } from '../index.js';
import { users, type NewUser, type User } from '../schema.js';

export interface CreateUserWithProfileInput {
  readonly firebaseUid: string;
  readonly username: string;
  readonly handle: string;
  readonly did: string;
  readonly walletAddress: string;
  readonly chain: string;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly authProvider: string;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly displayName: string;
  /** ISO YYYY-MM-DD */
  readonly dateOfBirth: string;
  readonly sex: 'female' | 'male' | 'prefer_not_to_say';
  readonly countryCode: string | null;
  readonly locale: string;
  /** AES-256-GCM ciphertext bundle from `encrypt()`. */
  readonly pdsPasswordEncrypted: string;
}

export class UsersRepository {
  public constructor(private readonly db: Database) {}

  /**
   * Inserts a new user. Throws on unique constraint violation.
   *
   * @param input - The user fields to insert.
   * @returns The inserted row including generated id and timestamps.
   */
  public async insert(input: NewUser): Promise<User> {
    const rows = await this.db.insert(users).values(input).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('UsersRepository.insert returned no row');
    }
    return row;
  }

  /**
   * Inserts a new user row populated with Phase 2 profile fields.
   * Used by createAccountService after PDS account creation.
   *
   * @param input - All fields needed to create a fully-formed user row.
   * @returns The inserted row.
   */
  public async createWithProfile(input: CreateUserWithProfileInput): Promise<User> {
    const row: NewUser = {
      firebaseUid: input.firebaseUid,
      username: input.username,
      handle: input.handle,
      did: input.did,
      walletAddress: input.walletAddress,
      chain: input.chain,
      email: input.email,
      phoneNumber: input.phoneNumber,
      authProvider: input.authProvider,
      emailVerified: input.emailVerified,
      phoneVerified: input.phoneVerified,
      displayName: input.displayName,
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
      countryCode: input.countryCode,
      locale: input.locale,
      pdsPasswordEncrypted: input.pdsPasswordEncrypted,
    };

    const inserted = await this.db.insert(users).values(row).returning();
    const head = inserted[0];
    if (head === undefined) {
      throw new Error('UsersRepository.createWithProfile returned no row');
    }
    return head;
  }

  /**
   * Finds a user by username (case-sensitive — username is stored lowercase).
   *
   * @param username - The username to look up.
   * @returns The user row if found; otherwise null.
   */
  public async findByUsername(username: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * Finds a user by handle.
   *
   * @param handle - The full handle (e.g., "akram.dev.fuzex.app").
   * @returns The user row if found; otherwise null.
   */
  public async findByHandle(handle: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.handle, handle)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * Finds a user by Firebase UID.
   *
   * @param firebaseUid - The Firebase Auth UID.
   * @returns The user row if found; otherwise null.
   */
  public async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Finds a user by DID.
   *
   * @param did - The atproto DID.
   * @returns The user row if found; otherwise null.
   */
  public async findByDid(did: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.did, did)).limit(1);
    return rows[0] ?? null;
  }
}
