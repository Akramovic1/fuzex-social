import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Hono } from 'hono';

import { HTTP_STATUS } from '@/shared/constants/httpStatus.js';
import { pingDatabase } from '@/shared/db/healthCheck.js';
import { type Database } from '@/shared/db/index.js';
import { logger } from '@/shared/logger/index.js';

const PACKAGE_VERSION = readPackageVersion();

interface HealthResponse {
  readonly status: 'ok' | 'degraded';
  readonly uptime: number;
  readonly version: string;
  readonly timestamp: string;
  readonly db: 'ok' | 'down';
}

interface HealthRouteDeps {
  readonly db: Database;
}

/**
 * Builds a Hono sub-router exposing GET /health.
 *
 * - 200 + status: "ok" when DB is reachable
 * - 200 + status: "degraded" when DB ping fails (process is up, just degraded)
 *
 * 200 is intentional even on degraded — the process is still serving HTTP.
 * 5xx would tell load balancers to remove this instance, undesirable for a
 * transient DB blip. A separate /health/ready can be added later for
 * pm2/k8s probes that need a hard gate.
 *
 * @param deps - { db } injected by the app factory.
 * @returns A Hono router exposing /health.
 */
export function buildHealthRoutes(deps: HealthRouteDeps): Hono {
  const router = new Hono();

  router.get('/health', async (c) => {
    const dbOk = await pingDatabase(deps.db);

    if (!dbOk) {
      logger.warn({ correlationId: c.get('correlationId') }, 'health check: db ping failed');
    }

    const body: HealthResponse = {
      status: dbOk ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      version: PACKAGE_VERSION,
      timestamp: new Date().toISOString(),
      db: dbOk ? 'ok' : 'down',
    };

    return c.json(body, HTTP_STATUS.OK);
  });

  return router;
}

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const raw = readFileSync(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version === 'string' && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // fall through to default
  }
  return '0.0.0';
}
