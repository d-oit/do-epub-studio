import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';

const checkRateLimitDO = vi.hoisted(() => vi.fn());
vi.mock('./rate-limit-client', () => ({ checkRateLimitDO }));

import { checkRateLimit } from './rate-limit-fallback';

function makeEnv(count = 3): Env {
  const first = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
  const statement = {
    bind: vi.fn(() => ({ run: first, first: vi.fn().mockResolvedValue({ request_count: count }) })),
  };
  return {
    RATE_LIMITER: {} as DurableObjectNamespace,
    DB: { prepare: vi.fn(() => statement) } as unknown as D1Database,
  } as unknown as Env;
}

describe('D1 rate-limit fallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the distributed result when the Durable Object answers', async () => {
    checkRateLimitDO.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 1234 });
    const result = await checkRateLimit(makeEnv(), 'invite', 'key', {
      maxRequests: 5,
      windowMs: 1000,
    });
    expect(result).toEqual({ allowed: true, remaining: 4, resetAt: 1234 });
  });

  it('uses D1 when the Durable Object is unavailable', async () => {
    checkRateLimitDO.mockResolvedValue({ allowed: true, remaining: 0, resetAt: 0 });
    const result = await checkRateLimit(makeEnv(), 'invite', 'key', {
      maxRequests: 2,
      windowMs: 1000,
    });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});
