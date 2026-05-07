/**
 * Decodes a JWT WITHOUT verifying its signature.
 *
 * This is intentional — signature verification is the PDS's job. The tests
 * use this only to inspect claims (scope, sub, aud, exp, jti) for assertions.
 *
 * @param token - JWT string with three base64url segments.
 * @returns Parsed `header` and `payload` as plain objects.
 */
export function decodeJwt(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error(`Not a JWT: expected 3 segments, got ${String(parts.length)}`);
  }
  const [h, p] = parts;
  if (h === undefined || p === undefined) {
    throw new Error('JWT has missing segments');
  }
  return {
    header: decodeSegment(h),
    payload: decodeSegment(p),
  };
}

function decodeSegment(seg: string): Record<string, unknown> {
  // base64url -> base64 with padding
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}
