/**
 * Crypto Utility Tests
 *
 * Tests the migration-focused crypto functions:
 * - initializeEncryption: Initialize with env key (now optional, returns boolean)
 * - isEncryptionInitialized: Check initialization state
 * - looksEncrypted: Detect if a string might be encrypted
 * - tryDecrypt: Attempt decryption, returning null on failure
 * - migrateToken: Migrate encrypted tokens to plain text
 *
 * Note: Token encryption has been phased out. These functions now primarily
 * support migrating existing encrypted tokens to plain text storage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Valid 32-byte key as 64 hex characters
const VALID_KEY = 'a'.repeat(64);

describe('crypto', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  describe('initializeEncryption', () => {
    it('should return true with valid 64-char hex key', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;

      const { initializeEncryption: init, isEncryptionInitialized: isInit } =
        await import('../crypto.js');

      expect(init()).toBe(true);
      expect(isInit()).toBe(true);
    });

    it('should return false when ENCRYPTION_KEY is missing', async () => {
      delete process.env.ENCRYPTION_KEY;

      const { initializeEncryption: init, isEncryptionInitialized: isInit } =
        await import('../crypto.js');

      expect(init()).toBe(false);
      expect(isInit()).toBe(false);
    });

    it('should return false when ENCRYPTION_KEY is empty string', async () => {
      process.env.ENCRYPTION_KEY = '';

      const { initializeEncryption: init } = await import('../crypto.js');

      expect(init()).toBe(false);
    });

    it('should return false when key is wrong length', async () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(32); // Too short

      const { initializeEncryption: init } = await import('../crypto.js');

      expect(init()).toBe(false);
    });
  });

  describe('isEncryptionInitialized', () => {
    it('should return false before initialization', async () => {
      delete process.env.ENCRYPTION_KEY;

      const { isEncryptionInitialized: isInit } = await import('../crypto.js');

      expect(isInit()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;

      const { initializeEncryption: init, isEncryptionInitialized: isInit } =
        await import('../crypto.js');

      init();
      expect(isInit()).toBe(true);
    });
  });

  describe('looksEncrypted', () => {
    it('should return false for short strings', async () => {
      const { looksEncrypted } = await import('../crypto.js');

      expect(looksEncrypted('short')).toBe(false);
      expect(looksEncrypted('abc123')).toBe(false);
      expect(looksEncrypted('')).toBe(false);
    });

    it('should return false for non-base64 strings', async () => {
      const { looksEncrypted } = await import('../crypto.js');

      expect(looksEncrypted('this is not base64!!!')).toBe(false);
      expect(looksEncrypted('hello world with spaces')).toBe(false);
    });

    it('should return false for typical Plex tokens', async () => {
      const { looksEncrypted } = await import('../crypto.js');

      // Plex tokens are typically 20-char alphanumeric
      expect(looksEncrypted('abcdefghij1234567890')).toBe(false);
      expect(looksEncrypted('PLEX_TOKEN_12345678')).toBe(false);
    });

    it('should return true for long base64 strings that could be encrypted', async () => {
      const { looksEncrypted } = await import('../crypto.js');

      // Minimum encrypted length is ~45 chars for IV + AuthTag + minimal ciphertext
      const longBase64 = Buffer.from('x'.repeat(40)).toString('base64');
      expect(looksEncrypted(longBase64)).toBe(true);
    });
  });

  describe('tryDecrypt', () => {
    it('should return null when encryption is not initialized', async () => {
      delete process.env.ENCRYPTION_KEY;

      const { tryDecrypt } = await import('../crypto.js');

      expect(tryDecrypt('somedata')).toBeNull();
    });

    it('should return null for invalid encrypted data', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;

      const { initializeEncryption: init, tryDecrypt } = await import('../crypto.js');
      init();

      expect(tryDecrypt('not-encrypted')).toBeNull();
      expect(tryDecrypt('invalid-base64!!!')).toBeNull();
    });

    it('should return null for data encrypted with different key', async () => {
      process.env.ENCRYPTION_KEY = VALID_KEY;

      const { initializeEncryption: init, tryDecrypt } = await import('../crypto.js');
      init();

      // This is random base64 that won't decrypt with our key
      const randomEncrypted = Buffer.from('x'.repeat(50)).toString('base64');
      expect(tryDecrypt(randomEncrypted)).toBeNull();
    });
  });

  describe('migrateToken', () => {
    it('should return plain text token unchanged if it does not look encrypted', async () => {
      const { migrateToken } = await import('../crypto.js');

      const plainToken = 'plex-token-12345';
      const result = migrateToken(plainToken);

      expect(result.plainText).toBe(plainToken);
      expect(result.wasEncrypted).toBe(false);
    });

    it('should return token as-is if it looks encrypted but cannot be decrypted', async () => {
      delete process.env.ENCRYPTION_KEY; // No key available

      const { migrateToken } = await import('../crypto.js');

      // Long base64 string that looks encrypted
      const fakeEncrypted = Buffer.from('x'.repeat(50)).toString('base64');
      const result = migrateToken(fakeEncrypted);

      expect(result.plainText).toBe(fakeEncrypted);
      expect(result.wasEncrypted).toBe(false);
    });
  });
});
