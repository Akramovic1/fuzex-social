import { existsSync, readFileSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { config } from '@/shared/config/index.js';
import { logger } from '@/shared/logger/index.js';

let appInstance: App | undefined;

/**
 * Returns the singleton Firebase Admin App, initializing it on first call.
 * The service account JSON is loaded from FIREBASE_SERVICE_ACCOUNT_PATH.
 *
 * @returns The initialized firebase-admin App instance.
 */
export function getFirebaseApp(): App {
  if (appInstance !== undefined) {
    return appInstance;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    const reused = existingApps[0];
    if (reused === undefined) {
      throw new Error('firebase-admin getApps() returned a non-empty array with undefined head');
    }
    appInstance = reused;
    return appInstance;
  }

  const credentialPath = resolvePath(config.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (!existsSync(credentialPath)) {
    throw new Error(
      `firebase service account not found at ${credentialPath} (set FIREBASE_SERVICE_ACCOUNT_PATH)`,
    );
  }

  const raw = readFileSync(credentialPath, 'utf8');
  const serviceAccount = JSON.parse(raw) as Parameters<typeof cert>[0];

  appInstance = initializeApp({
    credential: cert(serviceAccount),
    projectId: config.env.FIREBASE_PROJECT_ID,
  });

  logger.info(
    { projectId: config.env.FIREBASE_PROJECT_ID, credentialPath },
    'firebase admin initialized',
  );

  return appInstance;
}

/**
 * Returns the firebase-admin Auth client for the singleton app.
 *
 * @returns An Auth instance for verifying ID tokens.
 */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Returns the firebase-admin Firestore client for the singleton app.
 *
 * @returns A Firestore instance.
 */
export function getFirestoreClient(): Firestore {
  return getFirestore(getFirebaseApp());
}

/**
 * Resets the cached app singleton. For tests only — never call in production.
 */
export function __resetFirebaseAppForTesting(): void {
  appInstance = undefined;
}
