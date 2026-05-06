/* eslint-disable import/no-default-export */
import 'dotenv/config';
import type { Config } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required for drizzle-kit operations');
}

const config: Config = {
  schema: './src/shared/db/schema.ts',
  out: './src/shared/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
};

export default config;
