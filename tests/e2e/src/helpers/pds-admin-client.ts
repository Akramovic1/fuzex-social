import { config } from './config.js';

export interface PdsAccountInfo {
  readonly did: string;
  readonly handle: string;
  readonly email?: string;
  readonly emailConfirmedAt?: string;
}

/**
 * Calls the PDS admin getAccountInfo endpoint. Requires PDS_ADMIN_PASSWORD.
 *
 * @param did - The DID to look up.
 * @returns The account info, or `null` if the account does not exist.
 * @throws If PDS_ADMIN_PASSWORD is not set or the call fails for non-404 reasons.
 */
export async function getPdsAccountInfo(did: string): Promise<PdsAccountInfo | null> {
  if (config.pdsAdminPassword === null) {
    throw new Error('PDS_ADMIN_PASSWORD is not set; cannot call PDS admin endpoints');
  }
  const url = `${config.pdsBase}/xrpc/com.atproto.admin.getAccountInfo?did=${encodeURIComponent(did)}`;
  const auth = `Basic ${Buffer.from(`admin:${config.pdsAdminPassword}`).toString('base64')}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: auth },
  });
  if (res.status === 400 || res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PDS admin getAccountInfo failed (${res.status}): ${body}`);
  }
  return (await res.json()) as PdsAccountInfo;
}
