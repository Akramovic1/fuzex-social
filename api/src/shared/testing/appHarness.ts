import { serve, type ServerType } from '@hono/node-server';
import { type Hono } from 'hono';

import { buildApp } from '@/app.js';
import {
  type CreateAccountService,
  type GetSessionService,
} from '@/modules/api-social/services/index.js';
import { closePool } from '@/shared/db/client.js';

import { createTestDb, type TestDbHandle } from './testDb.js';

export interface AppHarness {
  readonly app: Hono;
  readonly handler: ServerType;
  readonly close: () => Promise<void>;
  readonly testDb: TestDbHandle;
}

export interface BuildAppHarnessOptions {
  /** Optional Phase 2 service stubs. If omitted, atproto routes are not mounted. */
  readonly createAccountService?: CreateAccountService;
  readonly getSessionService?: GetSessionService;
}

/**
 * Builds a fully-wired app bound to a test database, listening on an
 * ephemeral port. Returns the Node http server so supertest can drive it.
 *
 * Caller MUST call `close()` in afterAll, which:
 *   1. Closes the http server
 *   2. Closes the test DB pool
 *
 * @param options - Optional Phase 2 service overrides.
 * @returns An AppHarness with the running server and a cleanup function.
 */
export async function buildAppHarness(options: BuildAppHarnessOptions = {}): Promise<AppHarness> {
  const testDb = createTestDb();
  const app = buildApp({
    db: testDb.db,
    ...(options.createAccountService !== undefined
      ? { createAccountService: options.createAccountService }
      : {}),
    ...(options.getSessionService !== undefined
      ? { getSessionService: options.getSessionService }
      : {}),
  });

  const server = await new Promise<ServerType>((resolve) => {
    const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
  });

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err !== null && err !== undefined) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    await closePool(testDb.pool);
  };

  return {
    app,
    handler: server,
    close,
    testDb,
  };
}

/**
 * Returns the port the harness's server is listening on.
 * Useful for callers that need the URL rather than the server instance.
 *
 * @param harness - The harness to read the port from.
 * @returns The port number.
 */
export function getHarnessPort(harness: AppHarness): number {
  const addr = harness.handler.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('harness server has no AddressInfo');
  }
  return addr.port;
}
