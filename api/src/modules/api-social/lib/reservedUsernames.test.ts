import { describe, expect, it } from '@jest/globals';

import { isUsernameReserved } from './reservedUsernames.js';

describe('isUsernameReserved', () => {
  describe('explicit list', () => {
    it.each([
      'admin',
      'support',
      'help',
      'api',
      'app',
      'www',
      'pds',
      'fuzex',
      'bitcoin',
      'satoshi',
      'yoga',
      'system',
      'root',
    ])('rejects %s', (name) => {
      expect(isUsernameReserved(name)).toBe(true);
    });
  });

  describe('pattern matching', () => {
    it('rejects names starting with admin', () => {
      expect(isUsernameReserved('admin123')).toBe(true);
      expect(isUsernameReserved('administrator')).toBe(true);
    });

    it('rejects names starting with api', () => {
      expect(isUsernameReserved('api_v2')).toBe(true);
    });

    it('rejects names starting with root', () => {
      expect(isUsernameReserved('rootuser')).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('rejects mixed-case reserved names', () => {
      expect(isUsernameReserved('ADMIN')).toBe(true);
      expect(isUsernameReserved('Admin')).toBe(true);
      expect(isUsernameReserved('FuZeX')).toBe(true);
    });
  });

  describe('valid names', () => {
    it.each(['akram', 'sara', 'mohammed', 'cooluser', 'hello123', 'fitness_fan'])(
      'allows %s',
      (name) => {
        expect(isUsernameReserved(name)).toBe(false);
      },
    );
  });
});
