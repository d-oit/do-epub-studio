import { describe, it, expect } from 'vitest';
import { sanitizeAuditPayload } from '../index';

describe('sanitizeAuditPayload Redaction', () => {
  it('should redact sensitive keys in flat objects', () => {
    const payload = {
      username: 'jdoe',
      password: 'super-secret-password',
      token: 'abc-123-def',
      apiKey: 'key_12345',
      regularKey: 'regularValue'
    };

    const sanitized = sanitizeAuditPayload(payload);

    expect(sanitized['username']).toBe('jdoe');
    expect(sanitized['password']).toBe('[REDACTED]');
    expect(sanitized['token']).toBe('[REDACTED]');
    expect(sanitized['apiKey']).toBe('[REDACTED]');
    expect(sanitized['regularKey']).toBe('regularValue');
  });

  it('should redact sensitive keys in nested objects', () => {
    const payload = {
      user: {
        id: '123',
        auth: {
          sessionToken: 'xyz-987'
        }
      },
      metadata: {
        magicLink: 'https://example.com/login?token=sensitive'
      }
    };

    const sanitized = sanitizeAuditPayload(payload);

    const user = sanitized['user'] as Record<string, unknown>;
    expect(user['id']).toBe('123');
    expect(user['auth']).toBe('[REDACTED]');

    const metadata = sanitized['metadata'] as Record<string, unknown>;
    expect(metadata['magicLink']).toBe('[REDACTED]');
  });

  it('should redact sensitive keys in arrays', () => {
    const payload = {
      credentials: [
        { type: 'password', value: 'secret' },
        { type: 'token', secret: 'abc' }
      ]
    };

    const sanitized = sanitizeAuditPayload(payload);

    const credentials = sanitized['credentials'] as Array<Record<string, unknown>>;
    expect(credentials[0]?.['type']).toBe('password');
    expect(credentials[0]?.['value']).toBe('secret'); // 'value' is not in sensitive keys
    expect(credentials[1]?.['type']).toBe('token');
    expect(credentials[1]?.['secret']).toBe('[REDACTED]');
  });

  it('should handle case insensitivity and special characters in keys', () => {
    const payload = {
      'PASSWORD': '123',
      'Session-Token': '456',
      'magic_link': '789'
    };

    const sanitized = sanitizeAuditPayload(payload);

    expect(sanitized['PASSWORD']).toBe('[REDACTED]');
    expect(sanitized['Session-Token']).toBe('[REDACTED]');
    expect(sanitized['magic_link']).toBe('[REDACTED]');
  });
});
