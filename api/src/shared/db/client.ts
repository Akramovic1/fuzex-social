import pg from 'pg';

export type DbPool = pg.Pool;

interface CreatePoolOptions {
  readonly connectionString: string;
  readonly max?: number;
  readonly idleTimeoutMillis?: number;
  readonly connectionTimeoutMillis?: number;
}

const DEFAULT_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

/**
 * Creates a new Postgres connection pool.
 * Caller is responsible for calling closePool when done.
 *
 * @param options - Connection options.
 * @returns A pg Pool instance.
 */
export function createPool(options: CreatePoolOptions): DbPool {
  return new pg.Pool({
    connectionString: options.connectionString,
    max: options.max ?? DEFAULT_MAX,
    idleTimeoutMillis: options.idleTimeoutMillis ?? DEFAULT_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? DEFAULT_CONNECT_TIMEOUT_MS,
  });
}

/**
 * Closes a pool. Idempotent — safe to call multiple times.
 *
 * @param pool - The pool to close.
 */
export async function closePool(pool: DbPool): Promise<void> {
  if (pool.ended) {
    return;
  }
  await pool.end();
}
