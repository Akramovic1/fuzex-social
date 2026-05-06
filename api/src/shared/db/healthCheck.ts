import { sql } from 'drizzle-orm';

import { type Database } from './index.js';

/**
 * Executes `SELECT 1` against the database.
 * Returns true if the query succeeds within the pool's connection timeout.
 *
 * @param db - The Drizzle database instance.
 * @returns Promise<boolean> — true on success, false on any error.
 */
export async function pingDatabase(db: Database): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
