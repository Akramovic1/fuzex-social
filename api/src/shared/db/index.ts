import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

import { config } from '@/shared/config/index.js';

import { createPool, type DbPool } from './client.js';
import * as relations from './relations.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema & typeof relations>;

let cachedPool: DbPool | undefined;
let cachedDb: Database | undefined;

/**
 * Returns the application's singleton Drizzle DB instance.
 * The pool is lazily initialized on first call.
 *
 * NOTE: In tests, do NOT use this. Build your own pool/db with
 * the test DATABASE_URL via createPool() + drizzle().
 *
 * @returns The application's Drizzle database instance.
 */
export function getDb(): Database {
  if (cachedDb !== undefined) {
    return cachedDb;
  }
  cachedPool = createPool({ connectionString: config.env.DATABASE_URL });
  cachedDb = drizzle(cachedPool, { schema: { ...schema, ...relations } });
  return cachedDb;
}

/**
 * Closes the singleton pool. Used during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  if (cachedPool === undefined) {
    return;
  }
  if (!cachedPool.ended) {
    await cachedPool.end();
  }
  cachedPool = undefined;
  cachedDb = undefined;
}

export { schema, relations };
