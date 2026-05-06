import { describe, expect, it } from '@jest/globals';

import { type FirebaseAuthContext } from '@/shared/middleware/firebaseAuth.js';

import { deriveEmail, isSyntheticEmail } from './syntheticEmail.js';

function ctx(overrides: Partial<FirebaseAuthContext> = {}): FirebaseAuthContext {
  return {
    uid: 'uid-1',
    email: null,
    phoneNumber: null,
    emailVerified: false,
    phoneVerified: false,
    authProvider: 'password',
    ...overrides,
  };
}

describe('deriveEmail', () => {
  it('uses the real email when present', () => {
    expect(deriveEmail(ctx({ email: 'akram@example.com' }))).toBe('akram@example.com');
  });

  it('synthesizes a phone-based email when no email is present', () => {
    const result = deriveEmail(ctx({ phoneNumber: '+1 (555) 123-4567' }));
    expect(result).toBe('phone-15551234567@email.fuzex.social');
  });

  it('falls back to a uid-based email when neither email nor phone is present', () => {
    const result = deriveEmail(ctx({ uid: 'firebase-uid-XYZ' }));
    expect(result).toBe('uid-firebase-uid-XYZ@email.fuzex.social');
  });

  it('prefers email over phone when both are present', () => {
    const result = deriveEmail(ctx({ email: 'real@example.com', phoneNumber: '+15551234567' }));
    expect(result).toBe('real@example.com');
  });
});

describe('isSyntheticEmail', () => {
  it('returns true for an address under SYNTHETIC_EMAIL_DOMAIN', () => {
    expect(isSyntheticEmail('phone-15551234567@email.fuzex.social')).toBe(true);
    expect(isSyntheticEmail('uid-abc@email.fuzex.social')).toBe(true);
  });

  it('returns false for real-looking addresses', () => {
    expect(isSyntheticEmail('akram@fuzex.io')).toBe(false);
    expect(isSyntheticEmail('user@gmail.com')).toBe(false);
  });
});
