import { randomBytes } from 'node:crypto';

/**
 * Generates a strong random password to use as the user's PDS account password.
 *
 * The user never sees or types this password — it's stored encrypted (AES-256-GCM
 * via {@link encrypt} for Phase 2; Secret Manager in Phase 3) and used by
 * fuzex-api when minting sessions on behalf of the user.
 *
 * @returns A 32-character base64url-safe random string.
 */
export function generatePdsPassword(): string {
  return randomBytes(24).toString('base64url');
}
