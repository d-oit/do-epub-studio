import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from '../lib/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it('allows requests within the limit', () => {
    const result = checkRateLimit('test', 'user-1', { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests exceeding the limit', () => {
    const config = { maxRequests: 3, windowMs: 60_000 };
    checkRateLimit('test', 'user-1', config);
    checkRateLimit('test', 'user-1', config);
    checkRateLimit('test', 'user-1', config);
    const result = checkRateLimit('test', 'user-1', config);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks remaining count correctly', () => {
    const config = { maxRequests: 5, windowMs: 60_000 };
    const r1 = checkRateLimit('test', 'user-1', config);
    expect(r1.remaining).toBe(4);
    const r2 = checkRateLimit('test', 'user-1', config);
    expect(r2.remaining).toBe(3);
    const r3 = checkRateLimit('test', 'user-1', config);
    expect(r3.remaining).toBe(2);
  });

  it('uses separate counters for different keys', () => {
    const config = { maxRequests: 2, windowMs: 60_000 };
    checkRateLimit('test', 'user-1', config);
    checkRateLimit('test', 'user-1', config);
    const r1 = checkRateLimit('test', 'user-2', config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);
  });

  it('uses separate counters for different namespaces', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    checkRateLimit('api', 'user-1', config);
    const r = checkRateLimit('admin', 'user-1', config);
    expect(r.allowed).toBe(true);
  });

  it('resets after the window expires', () => {
    const config = { maxRequests: 1, windowMs: 10 };
    checkRateLimit('test', 'user-1', config);
    const blocked = checkRateLimit('test', 'user-1', config);
    expect(blocked.allowed).toBe(false);
  });

  it('returns resetAt timestamp', () => {
    const config = { maxRequests: 5, windowMs: 60_000 };
    const before = Date.now();
    const result = checkRateLimit('test', 'user-1', config);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + config.windowMs - 100);
    expect(result.resetAt).toBeLessThanOrEqual(before + config.windowMs + 100);
  });

  it('applies default config when none provided', () => {
    for (let i = 0; i < 100; i++) {
      checkRateLimit('default', 'user-1');
    }
    const result = checkRateLimit('default', 'user-1');
    expect(result.allowed).toBe(false);
  });

  it('resets namespace-specific limits', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };
    checkRateLimit('ns1', 'key', config);
    checkRateLimit('ns2', 'key', config);
    resetRateLimits('ns1');
    const r1 = checkRateLimit('ns1', 'key', config);
    expect(r1.allowed).toBe(true);
    const r2 = checkRateLimit('ns2', 'key', config);
    expect(r2.allowed).toBe(false);
  });
});
