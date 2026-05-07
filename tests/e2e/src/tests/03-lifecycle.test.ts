import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { apiGet, apiPost } from '../helpers/api-client.js';
import { config, getHandleDomain } from '../helpers/config.js';
import { mintIdToken } from '../helpers/firebase-admin-client.js';
import { getPdsAccountInfo } from '../helpers/pds-admin-client.js';
import {
  createTestUserInFirebase,
  deleteFirebaseAndFirestore,
  generateTestUser,
  type TestUserParams,
} from '../helpers/test-user.js';

interface UsernameCheckResponse {
  username: string;
  available: boolean;
  reason: string | null;
}

interface CreateAccountResponse {
  did: string;
  handle: string;
  displayName: string;
}

interface ResolveResponse {
  handle: string;
  did: string;
  walletAddress: string;
  chain: string;
  tippingEnabled: boolean;
}

interface SessionResponse {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

const JWT_SHAPE = /^[\w-]+\.[\w-]+\.[\w-]+$/;
const DID_SHAPE = /^did:plc:[a-z0-9]+$/;

const WELLKNOWN_RETRIES = 5;
const WELLKNOWN_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Layer 3 — Full lifecycle (creates real PDS account)', () => {
  let user: TestUserParams;
  let createdDid: string;
  let createdHandle: string;
  const handleDomain = getHandleDomain();

  beforeAll(async () => {
    user = generateTestUser();
    // eslint-disable-next-line no-console
    console.log('\n[lifecycle] creating Firebase + Firestore for test user:');
    // eslint-disable-next-line no-console
    console.log(`  uid:      ${user.uid}`);
    // eslint-disable-next-line no-console
    console.log(`  email:    ${user.email}`);
    // eslint-disable-next-line no-console
    console.log(`  username: ${user.username}`);
    // eslint-disable-next-line no-console
    console.log(`  wallet:   ${user.walletAddress}\n`);
    await createTestUserInFirebase(user);
  }, 30000);

  afterAll(async () => {
    await deleteFirebaseAndFirestore(user.uid);
    // eslint-disable-next-line no-console
    console.log('\n[lifecycle] Firebase Auth user + Firestore doc deleted.');
    // eslint-disable-next-line no-console
    console.log('[lifecycle] Postgres + PDS sqlite rows are LEFT IN PLACE on the VPS.');
    // eslint-disable-next-line no-console
    console.log('[lifecycle] Manual cleanup commands (run on the VPS):');
    // eslint-disable-next-line no-console
    console.log(
      `  sudo -u postgres psql -d fuzex_social -c "DELETE FROM users WHERE firebase_uid = '${user.uid}';"`,
    );
    if (createdDid !== undefined) {
      // eslint-disable-next-line no-console
      console.log(
        `  sqlite3 /pds/account.sqlite "DELETE FROM account WHERE did='${createdDid}'; DELETE FROM actor WHERE did='${createdDid}';"`,
      );
    }
    // eslint-disable-next-line no-console
    console.log('[lifecycle] Or, to clean up ALL leftover e2e users at once:');
    // eslint-disable-next-line no-console
    console.log(
      `  sudo -u postgres psql -d fuzex_social -c "DELETE FROM users WHERE firebase_uid LIKE '${config.userPrefix}-%';"`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `  # Then for each leftover DID:  sqlite3 /pds/account.sqlite "DELETE FROM account WHERE did='did:plc:...';"\n`,
    );
  }, 30000);

  it('step 1: username is available before createAccount', async () => {
    const res = await apiGet<UsernameCheckResponse>(
      `/v1/username/check?username=${encodeURIComponent(user.username)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.reason).toBeNull();
  });

  it('step 2: createAccount returns 201 with new DID + handle + displayName', async () => {
    const idToken = await mintIdToken(user.uid);
    const res = await apiPost<CreateAccountResponse>('/v1/atproto/createAccount', null, {
      idToken,
    });
    expect(res.status).toBe(201);
    expect(res.body.did).toMatch(DID_SHAPE);
    expect(res.body.handle).toBe(`${user.username}${handleDomain}`);
    expect(res.body.displayName).toBe(user.name);
    createdDid = res.body.did;
    createdHandle = res.body.handle;
    // eslint-disable-next-line no-console
    console.log(`[lifecycle] new account: did=${createdDid} handle=${createdHandle}`);
  });

  it('step 3: username is now ALREADY_TAKEN', async () => {
    const res = await apiGet<UsernameCheckResponse>(
      `/v1/username/check?username=${encodeURIComponent(user.username)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.reason).toBe('ALREADY_TAKEN');
  });

  it('step 4: resolve returns the new DID + wallet', async () => {
    const res = await apiGet<ResolveResponse>(
      `/v1/resolve/${encodeURIComponent(createdHandle)}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.handle).toBe(createdHandle);
    expect(res.body.did).toBe(createdDid);
    expect(res.body.walletAddress.toLowerCase()).toBe(user.walletAddress.toLowerCase());
    expect(res.body.chain).toBe('ethereum');
    expect(res.body.tippingEnabled).toBe(true);
  });

  it(
    'step 5: well-known atproto-did resolves (Caddy mints on-demand cert; retries)',
    async () => {
      const url = `https://${createdHandle}/.well-known/atproto-did`;
      let lastError: unknown;
      let body = '';
      for (let attempt = 1; attempt <= WELLKNOWN_RETRIES; attempt += 1) {
        try {
          const res = await apiGet<string>(url);
          if (res.status === 200) {
            body = res.raw.replace(/\n+$/, '');
            if (body === createdDid) {
              return;
            }
          }
          lastError = new Error(`status=${String(res.status)} body=${res.raw.slice(0, 200)}`);
        } catch (err) {
          // SSL handshake failures throw; retry until Caddy obtains the cert.
          lastError = err;
        }
        if (attempt < WELLKNOWN_RETRIES) {
          // eslint-disable-next-line no-console
          console.log(
            `[lifecycle] step 5 attempt ${String(attempt)} failed; retrying in ${String(WELLKNOWN_DELAY_MS)}ms...`,
          );
          await sleep(WELLKNOWN_DELAY_MS);
        }
      }
      throw new Error(
        `well-known did not resolve after ${String(WELLKNOWN_RETRIES)} attempts. last=${String(
          lastError,
        )} body=${body}`,
      );
    },
    30000,
  );

  it('step 6: PDS admin getAccountInfo confirms account (skips if no admin password)', async () => {
    if (config.pdsAdminPassword === null) {
      // eslint-disable-next-line no-console
      console.log('[lifecycle] step 6 skipped — PDS_ADMIN_PASSWORD not set');
      return;
    }
    const info = await getPdsAccountInfo(createdDid);
    expect(info).not.toBeNull();
    expect(info?.did).toBe(createdDid);
    expect(info?.handle).toBe(createdHandle);
  });

  it('step 7: getSession works for the new user', async () => {
    const idToken = await mintIdToken(user.uid);
    const res = await apiPost<SessionResponse>('/v1/atproto/getSession', null, { idToken });
    expect(res.status).toBe(200);
    expect(res.body.did).toBe(createdDid);
    expect(res.body.handle).toBe(createdHandle);
    expect(res.body.accessJwt).toMatch(JWT_SHAPE);
    expect(res.body.refreshJwt).toMatch(JWT_SHAPE);
  });

  it('step 8: createAccount is idempotent — returns same DID', async () => {
    const idToken = await mintIdToken(user.uid);
    const res = await apiPost<CreateAccountResponse>('/v1/atproto/createAccount', null, {
      idToken,
    });
    expect([200, 201]).toContain(res.status);
    expect(res.body.did).toBe(createdDid);
    expect(res.body.handle).toBe(createdHandle);
  });
});
