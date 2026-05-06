import { describe, expect, it, jest } from '@jest/globals';

import { PdsAdminClient } from './pdsAdminClient.js';

const BASE_URL = 'https://pds.test.example';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-pass';

function makeClient(fetcher: typeof fetch): PdsAdminClient {
  return new PdsAdminClient({
    baseUrl: BASE_URL,
    adminUsername: ADMIN_USER,
    adminPassword: ADMIN_PASS,
    fetcher,
  });
}

describe('PdsAdminClient', () => {
  it('createInviteCode posts with Basic admin auth and returns the code', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher = jest.fn(async (url: URL | string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ code: 'INVITE-XYZ' }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = makeClient(fetcher);
    const result = await client.createInviteCode(2);

    expect(result.code).toBe('INVITE-XYZ');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${BASE_URL}/xrpc/com.atproto.server.createInviteCode`);
    const headers = calls[0]?.init?.headers as Record<string, string>;
    const expectedAuth = `Basic ${Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64')}`;
    expect(headers.Authorization).toBe(expectedAuth);
    const body0 = calls[0]?.init?.body;
    expect(typeof body0).toBe('string');
    expect(JSON.parse(body0 as string)).toEqual({ useCount: 2 });
  });

  it('createAccount succeeds and returns identity + jwts', async () => {
    const fetcher = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            did: 'did:plc:abc',
            handle: 'akram.dev.fuzex.social',
            accessJwt: 'access-jwt',
            refreshJwt: 'refresh-jwt',
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const client = makeClient(fetcher);
    const result = await client.createAccount({
      email: 'akram@example.com',
      handle: 'akram.dev.fuzex.social',
      password: 'pwd',
    });

    expect(result.did).toBe('did:plc:abc');
    expect(result.accessJwt).toBe('access-jwt');
  });

  it('createAccount throws when PDS returns non-2xx', async () => {
    const fetcher = jest.fn(
      async () => new Response('handle taken', { status: 400 }),
    ) as unknown as typeof fetch;

    const client = makeClient(fetcher);
    await expect(
      client.createAccount({
        email: 'a@b.c',
        handle: 'taken.dev.fuzex.social',
        password: 'pwd',
      }),
    ).rejects.toThrow(/PDS createAccount failed: 400/);
  });

  it('createSession returns identity + jwts on success', async () => {
    const fetcher = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            did: 'did:plc:abc',
            handle: 'akram.dev.fuzex.social',
            accessJwt: 'a',
            refreshJwt: 'r',
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const client = makeClient(fetcher);
    const result = await client.createSession('akram.dev.fuzex.social', 'pwd');
    expect(result.handle).toBe('akram.dev.fuzex.social');
    expect(result.accessJwt).toBe('a');
  });

  it('putProfile sends Bearer accessJwt and PUT body', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher = jest.fn(async (url: URL | string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const client = makeClient(fetcher);
    await client.putProfile('access-jwt', 'did:plc:xyz', { displayName: 'Akram' });

    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer access-jwt');
    const rawBody = calls[0]?.init?.body;
    expect(typeof rawBody).toBe('string');
    const body = JSON.parse(rawBody as string) as Record<string, unknown>;
    expect(body.repo).toBe('did:plc:xyz');
    expect(body.collection).toBe('app.bsky.actor.profile');
    expect((body.record as Record<string, unknown>).displayName).toBe('Akram');
  });
});
