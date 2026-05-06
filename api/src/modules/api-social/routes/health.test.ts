import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';

import { buildAppHarness, type AppHarness } from '@/shared/testing/appHarness.js';

describe('GET /health', () => {
  let harness: AppHarness;

  beforeAll(async () => {
    harness = await buildAppHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('returns 200 with status ok when DB is reachable', async () => {
    const res = await request(harness.handler).get('/health');
    const body = res.body as {
      status?: unknown;
      db?: unknown;
      uptime?: unknown;
      version?: unknown;
      timestamp?: unknown;
    };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime as number).toBeGreaterThanOrEqual(0);
    expect(typeof body.version).toBe('string');
    expect((body.version as string).length).toBeGreaterThan(0);
    expect(typeof body.timestamp).toBe('string');
    expect(() => new Date(body.timestamp as string)).not.toThrow();
  });

  it('echoes the X-Request-Id header from the request', async () => {
    const res = await request(harness.handler)
      .get('/health')
      .set('X-Request-Id', 'test-correlation-id-123');

    expect(res.headers['x-request-id']).toBe('test-correlation-id-123');
  });

  it('generates a UUID X-Request-Id when none is provided', async () => {
    const res = await request(harness.handler).get('/health');
    const id = res.headers['x-request-id'];
    expect(typeof id).toBe('string');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('includes rate limit headers', async () => {
    const res = await request(harness.handler).get('/health');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });
});
