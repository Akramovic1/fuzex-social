import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.length === 0) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env and fill in the required values.`,
    );
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? v : fallback;
}

function optionalNullable(name: string): string | null {
  const v = process.env[name];
  return v !== undefined && v.length > 0 ? v : null;
}

/**
 * Returns the handle domain (e.g. ".dev.fuzex.social") parsed from the
 * configured test user's handle.
 */
function deriveHandleDomain(handle: string): string {
  // Handle = "username" + ".dev.fuzex.social" — strip everything before the first dot.
  const dotIdx = handle.indexOf('.');
  if (dotIdx === -1) {
    throw new Error(`E2E_TEST_USER_HANDLE has no dot: ${handle}`);
  }
  return handle.slice(dotIdx);
}

const apiBase = optional('E2E_API_BASE', 'https://dev-api.fuzex.social');
const pdsBase = optional('E2E_PDS_BASE', 'https://pds.dev.fuzex.social');

export const config = {
  apiBase,
  pdsBase,
  firebaseWebApiKey: required('FIREBASE_WEB_API_KEY'),
  firebaseServiceAccountPath: optional(
    'FIREBASE_SERVICE_ACCOUNT_PATH',
    './firebase-service-account.json',
  ),
  testUserUid: required('E2E_TEST_USER_UID'),
  testUserHandle: required('E2E_TEST_USER_HANDLE'),
  testUserDid: required('E2E_TEST_USER_DID'),
  testUserWallet: required('E2E_TEST_USER_WALLET'),
  pdsAdminPassword: optionalNullable('PDS_ADMIN_PASSWORD'),
  userPrefix: optional('E2E_USER_PREFIX', 'e2e'),
} as const;

export function getHandleDomain(): string {
  return deriveHandleDomain(config.testUserHandle);
}
