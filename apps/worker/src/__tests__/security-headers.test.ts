import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  securityHeaders,
  minimalSecurityHeaders,
  applySecurityHeaders,
  applyMinimalSecurityHeaders,
} from '../lib/security-headers';
import { defined } from './helpers';

/**
 * The Permissions-Policy directives `docs/security-posture.md` (adopted)
 * requires on every response surface. GOAP-1009 P-04: `geolocation=()` was
 * missing from both the Pages and the Worker header sources, so these are
 * asserted explicitly and MUST NOT be dropped again.
 */
const REQUIRED_PERMISSIONS_POLICY = ['camera=()', 'microphone=()', 'geolocation=()'] as const;

/**
 * The full feature set shared by the Pages `_headers` and both Worker
 * header maps (header parity, GOAP-1009 P-04).
 */
const PARITY_PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'magnetometer=()',
  'gyroscope=()',
  'accelerometer=()',
] as const;

/** Split a Permissions-Policy header value into its trimmed directives. */
function parsePolicy(value: string): string[] {
  return value
    .split(',')
    .map((directive) => directive.trim())
    .filter(Boolean);
}

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
    // Minimal now includes a restrictive CSP
    expect(minimalSecurityHeaders).toHaveProperty('Content-Security-Policy');
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

  // SE2 — ADR-123 / Plan 122
  it('main CSP has no unsafe-inline anywhere (style-src or script-src)', () => {
    const csp = defined(securityHeaders['Content-Security-Policy']);
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");

    // style-src must include 'self' as the only style source
    const styleSrc = csp.match(/style-src ([^;]+)/)?.[1] ?? '';
    const styleTokens = styleSrc.split(' ').filter(Boolean);
    expect(styleTokens).toContain("'self'");
  });

  it('minimal CSP is unchanged (still restrictive)', () => {
    const csp = minimalSecurityHeaders['Content-Security-Policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  // GOAP-1009 P-04 — docs/security-posture.md (adopted) requires
  // `geolocation=()`; the Pages and Worker header sources had omitted it.
  // These assertions pin the required directives per source so a future
  // change cannot silently drop a feature restriction.
  it('full Permissions-Policy disables the adopted features (geolocation)', () => {
    const policy = defined(securityHeaders['Permissions-Policy'], 'Permissions-Policy');
    const directives = parsePolicy(policy);

    for (const required of REQUIRED_PERMISSIONS_POLICY) {
      expect(directives).toContain(required);
    }
    expect(directives).toEqual([...PARITY_PERMISSIONS_POLICY]);
  });

  it('minimal Permissions-Policy disables the adopted features (geolocation)', () => {
    const policy = defined(
      minimalSecurityHeaders['Permissions-Policy'],
      'minimal Permissions-Policy',
    );
    const directives = parsePolicy(policy);

    for (const required of REQUIRED_PERMISSIONS_POLICY) {
      expect(directives).toContain(required);
    }
    expect(directives).toEqual([...PARITY_PERMISSIONS_POLICY]);
  });

  it('Pages _headers emits the same Permissions-Policy as the Worker', () => {
    const headersPath = path.resolve(__dirname, '../../../web/public/_headers');
    const content = fs.readFileSync(headersPath, 'utf-8');

    const match = content.match(/^[ \t]*Permissions-Policy:[ \t]*(.+)$/m);
    if (!match) throw new Error('Permissions-Policy header not found in apps/web/public/_headers');

    const directives = parsePolicy(defined(match[1], 'Pages Permissions-Policy'));

    for (const required of REQUIRED_PERMISSIONS_POLICY) {
      expect(directives).toContain(required);
    }
    expect(directives).toEqual([...PARITY_PERMISSIONS_POLICY]);
  });
});
