const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

const VALID_CHARSET = /^[a-z0-9-]+$/;
const HAS_UPPERCASE = /[A-Z]/;
const STARTS_OR_ENDS_WITH_HYPHEN = /^-|-$/;
const ONLY_DIGITS = /^[0-9]+$/;

export type UsernameValidationFailure =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'UPPERCASE_NOT_ALLOWED'
  | 'INVALID_CHARSET'
  | 'STARTS_OR_ENDS_WITH_HYPHEN'
  | 'CONSECUTIVE_HYPHENS'
  | 'ONLY_DIGITS';

interface ValidationOk {
  readonly ok: true;
}

interface ValidationFail {
  readonly ok: false;
  readonly reason: UsernameValidationFailure;
}

export type UsernameValidationResult = ValidationOk | ValidationFail;

/**
 * Validates the structural format of a username.
 *
 * Rules:
 *   - 3–30 chars
 *   - No uppercase letters (atproto handles are case-insensitive; we store
 *     and compare in lowercase, so accepting uppercase would silently mutate
 *     user input. Reject loudly instead.)
 *   - Only [a-z0-9-]
 *   - Cannot start or end with hyphen
 *   - Cannot contain consecutive hyphens
 *   - Cannot be all digits
 *
 * Pass the user's input AS-IS — do NOT lowercase first. The function will
 * tell you whether the input was already a valid lowercase username.
 *
 * @param username - The candidate username, exactly as the user typed it.
 * @returns A discriminated result.
 */
export function validateUsernameFormat(username: string): UsernameValidationResult {
  if (username.length < MIN_USERNAME_LENGTH) {
    return { ok: false, reason: 'TOO_SHORT' };
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return { ok: false, reason: 'TOO_LONG' };
  }
  if (HAS_UPPERCASE.test(username)) {
    return { ok: false, reason: 'UPPERCASE_NOT_ALLOWED' };
  }
  if (!VALID_CHARSET.test(username)) {
    return { ok: false, reason: 'INVALID_CHARSET' };
  }
  if (STARTS_OR_ENDS_WITH_HYPHEN.test(username)) {
    return { ok: false, reason: 'STARTS_OR_ENDS_WITH_HYPHEN' };
  }
  if (username.includes('--')) {
    return { ok: false, reason: 'CONSECUTIVE_HYPHENS' };
  }
  if (ONLY_DIGITS.test(username)) {
    return { ok: false, reason: 'ONLY_DIGITS' };
  }
  return { ok: true };
}
