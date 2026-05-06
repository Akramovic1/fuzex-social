import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { closePool, createPool, type DbPool } from './client.js';

interface RunMigrationsOptions {
  readonly connectionString: string;
  readonly migrationsFolder: string;
}

/**
 * Runs all pending migrations against the given database.
 * Creates a temporary pool, runs migrations, closes the pool.
 *
 * @param options - Connection string + migrations folder absolute path.
 */
export async function runMigrations(options: RunMigrationsOptions): Promise<void> {
  const pool: DbPool = createPool({
    connectionString: options.connectionString,
    max: 1,
  });
  const db: NodePgDatabase = drizzle(pool);
  try {
    await migrate(db, { migrationsFolder: options.migrationsFolder });
  } finally {
    await closePool(pool);
  }
}
