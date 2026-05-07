import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { config } from './config.js';

let appInstance: App | undefined;

function getApp(): App {
  if (appInstance !== undefined) {
    return appInstance;
  }
  const existing = getApps();
  if (existing.length > 0) {
    const head = existing[0];
    if (head === undefined) {
      throw new Error('firebase-admin getApps() returned a non-empty array with undefined head');
    }
    appInstance = head;
    return appInstance;
  }

  const credentialPath = resolvePath(config.firebaseServiceAccountPath);
  if (!existsSync(credentialPath)) {
    throw new Error(
      `Firebase service account JSON not found at ${credentialPath}. ` +
        `Set FIREBASE_SERVICE_ACCOUNT_PATH or place the file at the configured location.`,
    );
  }
  const raw = readFileSync(credentialPath, 'utf8');
  const serviceAccount = JSON.parse(raw) as Parameters<typeof cert>[0];

  appInstance = initializeApp({
    credential: cert(serviceAccount),
  });
  return appInstance;
}

export function adminAuth(): Auth {
  return getAuth(getApp());
}

export function adminFirestore(): Firestore {
  return getFirestore(getApp());
}

interface SignInResponse {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Mints a real Firebase ID token for the given UID via the
 * custom-token-then-exchange dance:
 *   1. firebase-admin createCustomToken(uid)
 *   2. POST identitytoolkit.googleapis.com .../accounts:signInWithCustomToken
 *
 * Useful for testing endpoints that require Firebase Bearer auth without
 * needing the mobile app to be running.
 */
export async function mintIdToken(uid: string): Promise<string> {
  const customToken = await adminAuth().createCustomToken(uid);
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(config.firebaseWebApiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to exchange custom token for idToken (${res.status}): ${errBody}`);
  }
  const json = (await res.json()) as SignInResponse;
  return json.idToken;
}
