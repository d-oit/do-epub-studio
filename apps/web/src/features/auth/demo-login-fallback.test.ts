import { describe, expect, it } from 'vitest';
import { shouldUseDemoCredentialFallback } from './demo-login-fallback';

describe('shouldUseDemoCredentialFallback', () => {
  it('reads the real timeout shape: a DOMException with a legacy numeric code', () => {
    const timeout = new DOMException('Request timeout', 'TimeoutError');

    // Guards the classifier against treating these numeric codes as API codes.
    expect(timeout.code).toBe(23);
    expect(shouldUseDemoCredentialFallback(timeout)).toBe(true);
  });

  it('allows a fetch transport failure', () => {
    expect(shouldUseDemoCredentialFallback(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('allows an unparseable successful SPA-shell response', () => {
    const invalidResponse = Object.assign(new Error('Invalid server response'), { status: 200 });

    expect(shouldUseDemoCredentialFallback(invalidResponse)).toBe(true);
  });

  it.each([
    [
      'rate-limit refusal',
      Object.assign(new Error('Too many attempts'), {
        code: 'TOO_MANY_REQUESTS',
        status: 429,
      }),
    ],
    [
      'demo-disabled refusal',
      Object.assign(new Error('Demo is disabled'), { code: 'DEMO_DISABLED', status: 403 }),
    ],
    [
      'coded refusal without a status',
      Object.assign(new Error('Demo is disabled'), { code: 'DEMO_DISABLED' }),
    ],
    ['other HTTP refusal', Object.assign(new Error('Unauthorized'), { status: 401 })],
    [
      'unparseable non-success response',
      Object.assign(new Error('Invalid server response'), { status: 503 }),
    ],
  ])('rejects %s', (_label, error) => {
    expect(shouldUseDemoCredentialFallback(error)).toBe(false);
  });

  it('rejects a caller cancellation DOMException', () => {
    const cancelled = new DOMException('Aborted', 'AbortError');

    expect(cancelled.code).toBe(20);
    expect(shouldUseDemoCredentialFallback(cancelled)).toBe(false);
  });

  it.each([
    ['generic error', new Error('Unexpected failure')],
    ['non-error value', 'Failed to fetch'],
  ])('rejects %s', (_label, error) => {
    expect(shouldUseDemoCredentialFallback(error)).toBe(false);
  });
});
