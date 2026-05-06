import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

import {
  type CreateAccountService,
  type GetSessionService,
} from '@/modules/api-social/services/index.js';
import { buildAppHarness, type AppHarness } from '@/shared/testing/appHarness.js';

describe('atproto routes', () => {
  let harness: AppHarness;
  let createAccountExec: jest.Mock;
  let getSessionExec: jest.Mock;

  beforeAll(async () => {
    createAccountExec = jest.fn(async () => ({
      did: 'did:plc:test',
      handle: 'akram.dev.fuzex.app',
      displayName: 'Akram',
    }));
    getSessionExec = jest.fn(async () => ({
      did: 'did:plc:test',
      handle: 'akram.dev.fuzex.app',
      accessJwt: 'access-jwt',
      refreshJwt: 'refresh-jwt',
    }));

    const fakeCreateAccountService = {
      execute: createAccountExec,
    } as unknown as CreateAccountService;
    const fakeGetSessionService = {
      execute: getSessionExec,
    } as unknown as GetSessionService;

    harness = await buildAppHarness({
      createAccountService: fakeCreateAccountService,
      getSessionService: fakeGetSessionService,
    });
  });

  beforeEach(() => {
    createAccountExec.mockClear();
    getSessionExec.mockClear();
  });

  afterAll(async () => {
    await harness.close();
  });

  it('POST /v1/atproto/createAccount returns 401 without an Authorization header', async () => {
    const res = await request(harness.handler).post('/v1/atproto/createAccount');
    expect(res.status).toBe(401);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /v1/atproto/getSession returns 401 without an Authorization header', async () => {
    const res = await request(harness.handler).post('/v1/atproto/getSession');
    expect(res.status).toBe(401);
  });
});
