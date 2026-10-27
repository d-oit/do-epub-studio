import { beforeEach, describe, it, expect, vi } from 'vitest';
import { checkRateLimitDO, deleteRateLimitKey } from '../lib/rate-limit-client';
import { logAppError } from '../lib/observability';
import type { Env } from '../lib/env';
import type { RateLimiterDO } from '../lib/rate-limiter-do';

vi.mock('../lib/observability', () => ({ logAppError: vi.fn() }));

describe('checkRateLimitDO', () => {
  beforeEach(() => vi.clearAllMocks());

  const makeMockDO = (response: Record<string, unknown>) => ({
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    }),
  });

  const makeEnv = vi.fn((mockDO: Record<string, unknown>): Env => ({
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-id' }),
      get: vi.fn().mockReturnValue(mockDO),
    } as unknown as DurableObjectNamespace<RateLimiterDO>,
    BOOKS_BUCKET: {} as unknown as R2Bucket,
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
    } as unknown as D1Database,
    SENDER_EMAIL: {} as unknown as SendEmail,
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace,
    TURSO_DATABASE_URL: 'file::memory:',
    TURSO_AUTH_TOKEN: 'test-token',
    SESSION_SIGNING_SECRET: 'test-session-secret',
    INVITE_TOKEN_SECRET: 'test-invite-secret',
    APP_BASE_URL: 'http://localhost',
    WEBAUTHN_RP_ID: 'localhost',
    WEBAUTHN_ORIGIN: 'http://localhost:5173',
  }));

  it('returns allowed: true when DO returns allowed: true', async () => {
    const mockDO = makeMockDO({ allowed: true, remaining: 4, resetAt: 123456789 });
    const env = makeEnv(mockDO);

    const result = await checkRateLimitDO(env, 'test', 'user@example.com');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBe(123456789);
    expect(mockDO.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/check/test/user%40example.com'),
    );
  });

  it('returns the unavailable sentinel without logging when Pages has no DO binding', async () => {
    const env = {} as Env;
    expect(await checkRateLimitDO(env, 'test', 'user@example.com')).toEqual({
      allowed: true,
      remaining: 0,
      resetAt: 0,
    });
    await deleteRateLimitKey(env, 'test', 'user@example.com');
    expect(logAppError).not.toHaveBeenCalled();
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
    expect(logAppError).toHaveBeenCalledWith('rate_limit_client.error', expect.any(Error), {
      namespace: 'test',
      key: 'user@example.com',
    });
  });

  it('still logs genuine DO failures while deleting a key', async () => {
    const error = new Error('DO unavailable');
    const mockDO = { fetch: vi.fn().mockRejectedValue(error) };
    await deleteRateLimitKey(makeEnv(mockDO), 'test', 'user@example.com');
    expect(mockDO.fetch).toHaveBeenCalledWith('http://rate-limiter/key/test/user%40example.com', {
      method: 'DELETE',
    });
    expect(logAppError).toHaveBeenCalledWith('rate_limit_client.delete_key.error', error, {
      namespace: 'test',
      key: 'user@example.com',
    });
  });
});
