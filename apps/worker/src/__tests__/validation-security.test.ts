/**
 * Unit tests for security validation utilities
 */

import { describe, it, expect } from 'vitest';
import { isValidFileKey, isValidBookId, sanitizeEmail, sanitizeAuditPayload } from '../lib/validation-security';

describe('isValidFileKey', () => {
  it('should accept valid file keys with safe characters', () => {
    expect(isValidFileKey('book-123/epub/content.opf')).toBe(true);
    expect(isValidFileKey('my_book.epub')).toBe(true);
    expect(isValidFileKey('file-1.xhtml')).toBe(true);
    expect(isValidFileKey('a/b/c/d.epub')).toBe(true);
  });

  it('should reject path traversal attempts', () => {
    expect(isValidFileKey('../etc/passwd')).toBe(false);
    expect(isValidFileKey('..\\..\\windows\\system32')).toBe(false);
    expect(isValidFileKey('books/../secret.txt')).toBe(false);
    expect(isValidFileKey('....//....//etc/passwd')).toBe(false);
  });

  it('should reject null bytes', () => {
    expect(isValidFileKey('file\0.txt')).toBe(false);
    expect(isValidFileKey('file%00.txt')).toBe(false);
  });

  it('should reject backslashes', () => {
    expect(isValidFileKey('path\\to\\file')).toBe(false);
    expect(isValidFileKey('mixed/path\\and\\backslash')).toBe(false);
  });

  it('should reject absolute paths', () => {
    expect(isValidFileKey('/etc/passwd')).toBe(false);
    expect(isValidFileKey('/absolute/path/file.txt')).toBe(false);
  });

  it('should reject unsafe characters', () => {
    expect(isValidFileKey('file<script>.txt')).toBe(false);
    expect(isValidFileKey('file;rm -rf.txt')).toBe(false);
    expect(isValidFileKey('file|cat.txt')).toBe(false);
    expect(isValidFileKey('file&whoami.txt')).toBe(false);
  });

  it('should reject empty or invalid inputs', () => {
    expect(isValidFileKey('')).toBe(false);
expect(isValidFileKey(null as unknown)).toBe(false);
    expect(isValidFileKey(undefined as any)).toBe(false);
  });

  it('should detect encoded path traversal', () => {
    // These would decode to contain .. or \
    expect(isValidFileKey('file%2e%2e/etc')).toBe(false);
  });
});

describe('isValidBookId', () => {
  it('should accept valid UUIDs', () => {
    expect(isValidBookId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidBookId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
  });

  it('should accept valid slugs', () => {
    expect(isValidBookId('my-book-title')).toBe(true);
    expect(isValidBookId('book-123')).toBe(true);
    expect(isValidBookId('a')).toBe(true);
    expect(isValidBookId('abc')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidBookId('')).toBe(false);
    expect(isValidBookId('invalid slug with spaces')).toBe(false);
    expect(isValidBookId('UPPERCASE-SLUG')).toBe(false);
    expect(isValidBookId('-starts-with-dash')).toBe(false);
    expect(isValidBookId('ends-with-dash-')).toBe(false);
    expect(isValidBookId('../traversal')).toBe(false);
  });

  it('should reject null or undefined', () => {
    expect(isValidBookId(null as any)).toBe(false);
    expect(isValidBookId(undefined as any)).toBe(false);
  });
});

describe('sanitizeEmail', () => {
  it('should normalize valid emails', () => {
    expect(sanitizeEmail('User@Example.COM')).toBe('user@example.com');
    expect(sanitizeEmail('  test@email.com  ')).toBe('test@email.com');
  });

  it('should reject invalid emails', () => {
    expect(sanitizeEmail('')).toBe(null);
    expect(sanitizeEmail('not-an-email')).toBe(null);
    expect(sanitizeEmail('@missing-local.com')).toBe(null);
    expect(sanitizeEmail('missing-domain@')).toBe(null);
    expect(sanitizeEmail(null as any)).toBe(null);
    expect(sanitizeEmail(undefined as any)).toBe(null);
  });
});

describe('sanitizeAuditPayload', () => {
  it('should pass through safe fields', () => {
    const payload = { action: 'login', userId: '123', timestamp: '2024-01-01' };
    expect(sanitizeAuditPayload(payload)).toEqual(payload);
  });

  it('should redact password fields', () => {
    const payload = { email: 'user@test.com', password: 'secret123' };
    const sanitized = sanitizeAuditPayload(payload);
    expect(sanitized.email).toBe('user@test.com');
    expect(sanitized.password).toBe('[REDACTED]');
  });

  it('should redact token fields', () => {
    const payload = { sessionToken: 'abc123', refreshToken: 'xyz789' };
    const sanitized = sanitizeAuditPayload(payload);
    expect(sanitized.sessionToken).toBe('[REDACTED]');
    expect(sanitized.refreshToken).toBe('[REDACTED]');
  });

  it('should redact secret fields', () => {
    const payload = { apiKey: 'key123', apiSecret: 'secret456' };
    const sanitized = sanitizeAuditPayload(payload);
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.apiSecret).toBe('[REDACTED]');
  });

  it('should handle nested objects', () => {
    const payload = {
      user: { email: 'test@example.com', password: 'secret' },
      action: 'update',
    };
    const sanitized = sanitizeAuditPayload(payload);
    expect((sanitized.user as any).password).toBe('[REDACTED]');
    expect((sanitized.user as any).email).toBe('test@example.com');
  });

  it('should truncate large payloads', () => {
    const largeValue = 'a'.repeat(2000);
    const payload = { data: largeValue };
    const sanitized = sanitizeAuditPayload(payload, 1024);
    expect((sanitized.data as string).length).toBeLessThanOrEqual(1040); // 1024 + '... [truncated]'
    expect(sanitized.data).toContain('... [truncated]');
  });

  it('should handle empty or null payloads', () => {
    expect(sanitizeAuditPayload(null as any)).toEqual({});
    expect(sanitizeAuditPayload(undefined as any)).toEqual({});
    expect(sanitizeAuditPayload({})).toEqual({});
  });
});
