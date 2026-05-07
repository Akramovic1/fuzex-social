import { describe, expect, it } from 'vitest';

import { apiGet } from '../helpers/api-client.js';
import { config, getHandleDomain } from '../helpers/config.js';

interface UsernameCheckResponse {
  username: string;
  available: boolean;
  reason: string | null;
}

interface ResolveResponse {
  handle: string;
  did: string;
  walletAddress: string;
  chain: string;
  tippingEnabled: boolean;
}

describe('Layer 1 — Smoke (no auth, idempotent)', () => {
  it('GET /health returns 200 with status field', async () => {
    const res = await apiGet<{ status: string }>('/health');
    expect(res.status).toBe(200);
    expect(typeof res.body.status).toBe('string');
  });

  it('username/check: existing handle returns ALREADY_TAKEN', async () => {
    const username = config.testUserHandle.split('.')[0];
    const res = await apiGet<UsernameCheckResponse>(
      `/v1/username/check?username=${encodeURIComponent(username ?? 't100')}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('ALREADY_TAKEN');
  });

  it('username/check: uppercase returns UPPERCASE_NOT_ALLOWED', async () => {
    const res = await apiGet<UsernameCheckResponse>('/v1/username/check?username=ABC');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('UPPERCASE_NOT_ALLOWED');
  });

  it('username/check: reserved word returns RESERVED', async () => {
    const res = await apiGet<UsernameCheckResponse>('/v1/username/check?username=admin');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('RESERVED');
  });

  it('username/check: too short returns TOO_SHORT', async () => {
    const res = await apiGet<UsernameCheckResponse>('/v1/username/check?username=ab');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('TOO_SHORT');
  });

  it('username/check: 31+ chars returns TOO_LONG', async () => {
    // MAX_USERNAME_LENGTH in handleValidation.ts is 30 — use 31+
    const longName = 'a'.repeat(35);
    const res = await apiGet<UsernameCheckResponse>(
      `/v1/username/check?username=${longName}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('TOO_LONG');
  });

  it('username/check: invalid chars returns INVALID_CHARSET', async () => {
    // Underscore is not in [a-z0-9-]
    const res = await apiGet<UsernameCheckResponse>('/v1/username/check?username=hello_world');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('INVALID_CHARSET');
  });

  it('username/check: fresh random username is available', async () => {
    // Random lowercase alphanumeric, definitely not reserved or taken.
    const fresh = `fresh${Date.now().toString(36)}`;
    const res = await apiGet<UsernameCheckResponse>(
      `/v1/username/check?username=${fresh}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.reason).toBeNull();
  });

  it('GET /v1/resolve/<handle> returns full summary for existing user', async () => {
    const res = await apiGet<ResolveResponse>(
      `/v1/resolve/${encodeURIComponent(config.testUserHandle)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.handle).toBe(config.testUserHandle);
    expect(res.body.did).toBe(config.testUserDid);
    expect(res.body.walletAddress.toLowerCase()).toBe(config.testUserWallet.toLowerCase());
    expect(res.body.chain).toBe('ethereum');
    expect(res.body.tippingEnabled).toBe(true);
  });

  it('GET /v1/resolve/<missing-handle> returns 404', async () => {
    const handleDomain = getHandleDomain();
    // Use a short username that passes validation but won't exist in the DB.
    const missingHandle = `nope-${Date.now().toString(36).slice(-8)}${handleDomain}`;
    const res = await apiGet(`/v1/resolve/${encodeURIComponent(missingHandle)}`);
    expect(res.status).toBe(404);
  });

  it('GET https://<handle>/.well-known/atproto-did returns DID as plain text', async () => {
    const url = `https://${config.testUserHandle}/.well-known/atproto-did`;
    const res = await apiGet<string>(url);
    expect(res.status).toBe(200);
    // Body is the DID exactly, no trailing newline.
    expect(res.raw.replace(/\n+$/, '')).toBe(config.testUserDid);
  });

  it('PDS health endpoint is reachable', async () => {
    const res = await apiGet(`${config.pdsBase}/xrpc/_health`);
    expect(res.status).toBe(200);
  });
});
