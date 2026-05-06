/* eslint-disable import/no-default-export */
import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://fuzex_api_dev:devpassword@localhost:5433/fuzex_social_test';

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/shared/db/migrations');

const TEST_DB_NAME = 'fuzex_social_test';
const ADMIN_DB_URL = 'postgresql://fuzex_api_dev:devpassword@localhost:5433/postgres';

async function ensureTestDatabaseExists(): Promise<void> {
  const adminClient = new pg.Client({ connectionString: ADMIN_DB_URL });
  await adminClient.connect();
  try {
    const result = await adminClient.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME],
    );
    const row = result.rows[0];
    const exists = row !== undefined && Number.parseInt(row.count, 10) > 0;
    if (!exists) {
      await adminClient.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await adminClient.end();
  }
}

// Inlined migration runner: jestSetup is loaded by Jest's plain CJS loader,
// which bypasses the moduleNameMapper and the `.js → no-ext` resolution.
// Importing from src/ here would crash with "Cannot find module".
async function runTestMigrations(): Promise<void> {
  const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

export default async function globalSetup(): Promise<void> {
  await ensureTestDatabaseExists();
  await runTestMigrations();
}
