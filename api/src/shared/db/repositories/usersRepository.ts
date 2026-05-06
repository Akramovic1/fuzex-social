import { eq } from 'drizzle-orm';

import { type Database } from '../index.js';
import { users, type NewUser, type User } from '../schema.js';

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
