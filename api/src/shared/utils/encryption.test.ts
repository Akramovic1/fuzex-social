import { describe, expect, it } from '@jest/globals';

import { __resetEncryptionForTesting, decrypt, encrypt } from './encryption.js';

describe('encryption', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = 'super-secret-pds-password';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertexts on each call (random IV)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('throws when the bundle is too short', () => {
    expect(() => decrypt('aaaa')).toThrow(/too short/i);
  });

  it('throws when the auth tag does not verify', () => {
    const plaintext = 'tamper-evident';
    const encrypted = encrypt(plaintext);
    const buf = Buffer.from(encrypted, 'base64');
    // Flip a bit in the ciphertext portion (after the 12-byte IV + 16-byte tag)
    buf[buf.length - 1] = buf[buf.length - 1]! ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => decrypt(tampered)).toThrow();
  });

  it('caches the derived key across calls (smoke test via reset)', () => {
    const a = encrypt('first');
    __resetEncryptionForTesting();
    // After reset, encryption still works (re-derives key)
    const b = encrypt('second');
    expect(decrypt(a)).toBe('first');
    expect(decrypt(b)).toBe('second');
  });
});
