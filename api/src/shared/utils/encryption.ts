import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

import { config } from '@/shared/config/index.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
// Domain-separator salt; not secret. Bumping the suffix would invalidate
// previously-encrypted ciphertexts (use only for key-rotation events).
const KEY_SALT = 'fuzex-api-pds-password-v1';

let cachedKey: Buffer | undefined;

function getKey(): Buffer {
  if (cachedKey !== undefined) {
    return cachedKey;
  }
  cachedKey = scryptSync(config.env.PDS_PASSWORD_ENCRYPTION_KEY, KEY_SALT, 32);
  return cachedKey;
}

/**
 * Encrypts plaintext with AES-256-GCM using a key derived from
 * `PDS_PASSWORD_ENCRYPTION_KEY`. The output bundle is base64-encoded
 * `iv (12B) || authTag (16B) || ciphertext`.
 *
 * @param plaintext - The string to encrypt.
 * @returns Base64-encoded ciphertext bundle.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypts a bundle produced by {@link encrypt}.
 * Throws if the bundle is malformed or the auth tag fails verification.
 *
 * @param bundle - Base64-encoded ciphertext bundle.
 * @returns The original plaintext.
 */
export function decrypt(bundle: string): string {
  const buf = Buffer.from(bundle, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('encrypted bundle is too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Resets the cached key. For tests only — never call in production code.
 */
export function __resetEncryptionForTesting(): void {
  cachedKey = undefined;
}
