import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

import { closePool, createPool, type DbPool } from '@/shared/db/client.js';
import * as relations from '@/shared/db/relations.js';
import * as schema from '@/shared/db/schema.js';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://fuzex_api_dev:devpassword@localhost:5433/fuzex_social_test';

export type TestDatabase = NodePgDatabase<typeof schema & typeof relations>;

export interface TestDbHandle {
  readonly db: TestDatabase;
  readonly pool: DbPool;
  readonly close: () => Promise<void>;
}

/**
 * Creates a fresh test DB handle. Caller MUST call close() in afterAll.
 *
 * @returns Handle with db, pool, and a close function.
 */
export function createTestDb(): TestDbHandle {
  const pool = createPool({ connectionString: TEST_DATABASE_URL, max: 2 });
  const db: TestDatabase = drizzle(pool, { schema: { ...schema, ...relations } });
  return {
    db,
    pool,
    close: () => closePool(pool),
  };
}

/**
 * Truncates all tables. Use in beforeEach/afterEach for isolated tests.
 *
 * @param db - The test database handle.
 */
export async function truncateAll(db: TestDatabase): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE "audit_logs", "invite_codes", "users" RESTART IDENTITY CASCADE`,
  );
}
