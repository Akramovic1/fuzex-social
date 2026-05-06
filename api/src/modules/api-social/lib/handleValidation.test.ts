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
    it.each(['user_name', 'user.name', 'user@name', 'user name', 'UserName', 'usér'])(
      'rejects %s',
      (input) => {
        expect(validateUsernameFormat(input)).toEqual({
          ok: false,
          reason: 'INVALID_CHARSET',
        });
      },
    );
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
