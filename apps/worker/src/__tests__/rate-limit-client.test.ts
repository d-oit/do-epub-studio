import { describe, it, expect, vi } from 'vitest';
import { checkRateLimitDO } from '../lib/rate-limit-client';
import type { Env } from '../lib/env';

describe('checkRateLimitDO', () => {
  const makeMockDO = (response: any) => ({
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    }),
  });

  const makeEnv = (mockDO: any): Env => ({
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-id' }),
      get: vi.fn().mockReturnValue(mockDO),
    } as any,
    BOOKS_BUCKET: {} as any,
    TURSO_DATABASE_URL: 'http://localhost',
    TURSO_AUTH_TOKEN: 'test',
    SESSION_SIGNING_SECRET: 'test',
    INVITE_TOKEN_SECRET: 'test',
    APP_BASE_URL: 'http://localhost',
  });

  it('returns allowed: true when DO returns allowed: true', async () => {
    const mockDO = makeMockDO({ allowed: true, remaining: 4, resetAt: 123456789 });
    const env = makeEnv(mockDO);

    const result = await checkRateLimitDO(env, 'test', 'user@example.com');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBe(123456789);
    expect(mockDO.fetch).toHaveBeenCalledWith(expect.stringContaining('/check/test/user%40example.com'));
  });

  it('returns allowed: false when DO returns allowed: false', async () => {
    const mockDO = makeMockDO({ allowed: false, remaining: 0, resetAt: 123456789 });
    const env = makeEnv(mockDO);

    const result = await checkRateLimitDO(env, 'test', 'user@example.com');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('includes config parameters in the URL', async () => {
    const mockDO = makeMockDO({ allowed: true, remaining: 9, resetAt: 123456789 });
    const env = makeEnv(mockDO);

    await checkRateLimitDO(env, 'test', 'user@example.com', { maxRequests: 10, windowMs: 60000 });

    expect(mockDO.fetch).toHaveBeenCalledWith(expect.stringContaining('maxRequests=10'));
    expect(mockDO.fetch).toHaveBeenCalledWith(expect.stringContaining('windowMs=60000'));
  });

  it('fails open when DO fetch fails', async () => {
    const mockDO = {
      fetch: vi.fn().mockResolvedValue({ ok: false }),
    };
    const env = makeEnv(mockDO);

    const result = await checkRateLimitDO(env, 'test', 'user@example.com');

    expect(result.allowed).toBe(true);
  });

  it('fails open when DO fetch throws', async () => {
    const mockDO = {
      fetch: vi.fn().mockRejectedValue(new Error('DO error')),
    };
    const env = makeEnv(mockDO);

    const result = await checkRateLimitDO(env, 'test', 'user@example.com');

    expect(result.allowed).toBe(true);
  });
});
