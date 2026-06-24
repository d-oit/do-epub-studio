import { describe, it, expect } from 'vitest';
import { scrub, scrubForLog, isSensitiveKey } from '../redact';

describe('Log Redaction', () => {
  describe('isSensitiveKey', () => {
    it('detects password', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('Password')).toBe(true);
    });
    it('detects token variants', () => {
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('sessionToken')).toBe(true);
      expect(isSensitiveKey('session-token')).toBe(true);
    });
    it('detects api key', () => {
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('apikey')).toBe(true);
    });
    it('does not flag safe keys', () => {
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('id')).toBe(false);
    });
  });

  describe('scrub', () => {
    it('redacts sensitive keys in flat objects', () => {
      const result = scrub({ username: 'jdoe', password: 'secret123' }) as Record<string, unknown>;
      expect(result.username).toBe('jdoe');
      expect(result.password).toBe('[REDACTED]');
    });

    it('redacts sensitive keys in nested objects', () => {
      const result = scrub({
        user: { id: '1', auth: { token: 'abc' } },
      }) as Record<string, Record<string, Record<string, unknown>>>;
      expect(result.user.id).toBe('1');
      expect(result.user.auth.token).toBe('[REDACTED]');
    });

    it('redacts emails in string values', () => {
      const result = scrub({ message: 'Contact user@example.com for help' });
      expect((result as Record<string, string>).message).toBe('Contact [REDACTED] for help');
    });

    it('redacts Bearer tokens in string values', () => {
      const result = scrub({ header: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload' });
      expect((result as Record<string, string>).header).toBe('Authorization: Bearer [REDACTED]');
    });

    it('redacts long tokens in string values', () => {
      const longToken = 'a'.repeat(40);
      const result = scrub({ data: `prefix-${longToken}-suffix` });
      // The regex matches the entire alphanumeric+hyphen run as one token
      expect((result as Record<string, string>).data).toBe('[REDACTED]');
    });

    it('handles arrays', () => {
      const result = scrub([{ password: 'x' }, { username: 'y' }]) as Array<Record<string, string>>;
      expect(result[0]?.password).toBe('[REDACTED]');
      expect(result[1]?.username).toBe('y');
    });

    it('handles null and undefined', () => {
      expect(scrub(null)).toBe(null);
      expect(scrub(undefined)).toBe(undefined);
    });

    it('handles primitives', () => {
      expect(scrub(42)).toBe(42);
      expect(scrub(true)).toBe(true);
      expect(scrub('hello')).toBe('hello');
    });
  });

  describe('scrubForLog', () => {
    it('returns a JSON string', () => {
      const result = scrubForLog({ password: 'secret', username: 'jdoe' });
      expect(typeof result).toBe('string');
      expect(result).toContain('"username":"jdoe"');
      expect(result).toContain('"password":"[REDACTED]"');
    });

    it('handles circular references gracefully', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const result = scrubForLog(obj);
      // The scrub function has a depth limit, so circular references
      // are truncated at depth 8. The result is a valid JSON string
      // that does not throw.
      expect(typeof result).toBe('string');
      expect(result).toContain('"name"');
    });
  });
});
