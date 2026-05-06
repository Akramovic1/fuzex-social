import path from 'node:path';

import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/logger/index.js';

import { runMigrations } from './migrationRunner.js';

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/shared/db/migrations');

async function main(): Promise<void> {
  logger.info(
    { migrationsFolder: MIGRATIONS_FOLDER, env: config.env.NODE_ENV },
    'running migrations',
  );
  await runMigrations({
    connectionString: config.env.DATABASE_URL,
    migrationsFolder: MIGRATIONS_FOLDER,
  });
  logger.info('migrations complete');
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'migration failed');
  process.exit(1);
});
