import { describe, it, expect } from 'vitest';
import {
  securityHeaders,
  minimalSecurityHeaders,
  applySecurityHeaders,
  applyMinimalSecurityHeaders,
} from '../lib/security-headers';

describe('security headers', () => {
  it('defines full security headers', () => {
    expect(securityHeaders).toHaveProperty('X-Content-Type-Options', 'nosniff');
    expect(securityHeaders).toHaveProperty(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
    expect(securityHeaders).toHaveProperty('X-Frame-Options', 'DENY');
    expect(securityHeaders).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(securityHeaders).toHaveProperty('Permissions-Policy');
    expect(securityHeaders).toHaveProperty('Content-Security-Policy');
    expect(securityHeaders).toHaveProperty('Cross-Origin-Opener-Policy', 'same-origin');
    expect(securityHeaders).toHaveProperty('Cross-Origin-Resource-Policy', 'same-origin');
  });

  it('defines minimal security headers', () => {
    expect(minimalSecurityHeaders).toHaveProperty('X-Content-Type-Options', 'nosniff');
    expect(minimalSecurityHeaders).toHaveProperty('Strict-Transport-Security');
    expect(minimalSecurityHeaders).toHaveProperty('X-Frame-Options', 'DENY');
    expect(minimalSecurityHeaders).toHaveProperty('Referrer-Policy');
    expect(minimalSecurityHeaders).toHaveProperty('Permissions-Policy');
    expect(minimalSecurityHeaders).toHaveProperty('Cross-Origin-Opener-Policy', 'same-origin');
    // Minimal should NOT include CSP
    expect(minimalSecurityHeaders).not.toHaveProperty('Content-Security-Policy');
  });

  it('applies full security headers to a response', () => {
    const response = new Response('test', { status: 200 });
    const result = applySecurityHeaders(response);

    Object.entries(securityHeaders).forEach(([key, value]) => {
      expect(result.headers.get(key)).toBe(value);
    });

    // Should return the same response for chaining
    expect(result).toBe(response);
  });

  it('applies minimal security headers to a response', () => {
    const response = new Response('test', { status: 200 });
    const result = applyMinimalSecurityHeaders(response);

    Object.entries(minimalSecurityHeaders).forEach(([key, value]) => {
      expect(result.headers.get(key)).toBe(value);
    });

    expect(result).toBe(response);
  });

  it('freezes header objects to prevent mutation', () => {
    expect(Object.isFrozen(securityHeaders)).toBe(true);
    expect(Object.isFrozen(minimalSecurityHeaders)).toBe(true);
  });
});
