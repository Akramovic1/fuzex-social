import { describe, expect, it } from '@jest/globals';

import { validateUsernameFormat } from './handleValidation.js';

describe('validateUsernameFormat', () => {
  describe('accepts valid usernames', () => {
    it.each(['akr', 'akram', 'sara-lee', 'user-1', 'a1b2c3', 'a-b-c', 'cool123'])(
      'accepts %s',
      (input) => {
        expect(validateUsernameFormat(input)).toEqual({ ok: true });
      },
    );
  });

  describe('rejects invalid lengths', () => {
    it('rejects too short', () => {
      expect(validateUsernameFormat('ab')).toEqual({ ok: false, reason: 'TOO_SHORT' });
    });

    it('rejects empty', () => {
      expect(validateUsernameFormat('')).toEqual({ ok: false, reason: 'TOO_SHORT' });
    });

    it('rejects too long', () => {
      expect(validateUsernameFormat('a'.repeat(31))).toEqual({ ok: false, reason: 'TOO_LONG' });
    });
  });

  describe('rejects invalid charsets', () => {
    it.each(['user_name', 'user.name', 'user@name', 'user name', 'usér'])('rejects %s', (input) => {
      expect(validateUsernameFormat(input)).toEqual({
        ok: false,
        reason: 'INVALID_CHARSET',
      });
    });
  });

  describe('rejects uppercase usernames', () => {
    it.each(['UserName', 'AKRAM', 'Mixed', 'BADNAME', 'aKrAm'])(
      'rejects %s with UPPERCASE_NOT_ALLOWED',
      (input) => {
        expect(validateUsernameFormat(input)).toEqual({
          ok: false,
          reason: 'UPPERCASE_NOT_ALLOWED',
        });
      },
    );

    it('rejects mixed-case even when other rules would have failed', () => {
      // 'AB' is too short AND has uppercase — TOO_SHORT wins (length is checked first)
      expect(validateUsernameFormat('AB')).toEqual({ ok: false, reason: 'TOO_SHORT' });
    });
  });

  describe('rejects hyphen edge cases', () => {
    it('rejects leading hyphen', () => {
      expect(validateUsernameFormat('-akram')).toEqual({
        ok: false,
        reason: 'STARTS_OR_ENDS_WITH_HYPHEN',
      });
    });

    it('rejects trailing hyphen', () => {
      expect(validateUsernameFormat('akram-')).toEqual({
        ok: false,
        reason: 'STARTS_OR_ENDS_WITH_HYPHEN',
      });
    });

    it('rejects consecutive hyphens', () => {
      expect(validateUsernameFormat('a--b')).toEqual({
        ok: false,
        reason: 'CONSECUTIVE_HYPHENS',
      });
    });
  });

  describe('rejects all-digit names', () => {
    it.each(['123', '0001', '99999'])('rejects %s', (input) => {
      expect(validateUsernameFormat(input)).toEqual({ ok: false, reason: 'ONLY_DIGITS' });
    });
  });
});
