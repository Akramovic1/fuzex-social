interface ParseHandleSuccess {
  readonly ok: true;
  readonly username: string;
}

interface ParseHandleFailure {
  readonly ok: false;
  readonly reason:
    | 'EMPTY_INPUT'
    | 'EMPTY_DOMAIN'
    | 'INVALID_DOMAIN_SUFFIX'
    | 'NOT_MATCHING_DOMAIN'
    | 'EMPTY_USERNAME'
    | 'CONTAINS_SUBDOMAINS';
}

export type ParseHandleResult = ParseHandleSuccess | ParseHandleFailure;

function stripPort(host: string): string {
  const colonIdx = host.indexOf(':');
  return colonIdx === -1 ? host : host.slice(0, colonIdx);
}

/**
 * Extracts the username portion of a handle given a known domain suffix.
 *
 * Examples (domain `.dev.fuzex.app`):
 *  - `akram.dev.fuzex.app` → { ok: true, username: 'akram' }
 *  - `akram.dev.fuzex.app:443` → strips port → { ok: true, username: 'akram' }
 *  - `evil.akram.dev.fuzex.app` → { ok: false, reason: 'CONTAINS_SUBDOMAINS' }
 *  - `something.else.com` → { ok: false, reason: 'NOT_MATCHING_DOMAIN' }
 *
 * @param input - Fully-qualified handle (host header value or atproto handle).
 * @param domainSuffix - The domain suffix including leading dot (e.g., '.dev.fuzex.app').
 * @returns A discriminated result.
 */
export function parseHandle(input: string, domainSuffix: string): ParseHandleResult {
  if (input.length === 0) {
    return { ok: false, reason: 'EMPTY_INPUT' };
  }
  if (domainSuffix.length === 0) {
    return { ok: false, reason: 'EMPTY_DOMAIN' };
  }
  if (!domainSuffix.startsWith('.')) {
    return { ok: false, reason: 'INVALID_DOMAIN_SUFFIX' };
  }

  const hostNoPort = stripPort(input).toLowerCase();
  const suffix = domainSuffix.toLowerCase();

  if (!hostNoPort.endsWith(suffix)) {
    return { ok: false, reason: 'NOT_MATCHING_DOMAIN' };
  }

  const username = hostNoPort.slice(0, hostNoPort.length - suffix.length);

  if (username.length === 0) {
    return { ok: false, reason: 'EMPTY_USERNAME' };
  }
  if (username.includes('.')) {
    return { ok: false, reason: 'CONTAINS_SUBDOMAINS' };
  }

  return { ok: true, username };
}
