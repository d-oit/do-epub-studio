import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyRateLimit, getRateLimitConfig } from '../middleware/rate-limit';
import { checkRateLimitDO } from '../lib/rate-limit-client';
import type { Env } from '../lib/env';

vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: vi.fn(),
}));

describe('Rate Limiting Middleware', () => {
  const env = {
    RATE_LIMITER: {},
  } as Env;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRateLimitConfig', () => {
    it('returns auth limit for auth endpoints', () => {
      const { config, category } = getRateLimitConfig('/api/access/request');
      expect(config.maxRequests).toBe(10);
      expect(category).toBe('auth');
    });

    it('returns file limit for file endpoints', () => {
      const { config, category } = getRateLimitConfig('/api/files/book1/chapter1.html');
      expect(config.maxRequests).toBe(30);
      expect(category).toBe('files');
    });

    it('returns api limit for other endpoints', () => {
      const { config, category } = getRateLimitConfig('/api/books');
      expect(config.maxRequests).toBe(60);
      expect(category).toBe('api');
    });
  });

  describe('applyRateLimit', () => {
    it('allows request when within limits', async () => {
      const request = new Request('http://localhost/api/books', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      });

      vi.mocked(checkRateLimitDO).mockResolvedValue({
        allowed: true,
        remaining: 59,
        resetAt: Date.now() + 60000,
      });

      const { response, metadata } = await applyRateLimit(request, env);

      expect(response).toBeUndefined();
      expect(metadata).toBeDefined();
      expect(metadata?.remaining).toBe(59);
      expect(checkRateLimitDO).toHaveBeenCalledWith(env, 'ip:api', '1.2.3.4', expect.any(Object));
    });

    it('returns 429 when IP limit exceeded', async () => {
      const request = new Request('http://localhost/api/books', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      });

      vi.mocked(checkRateLimitDO).mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
      });

      const { response } = await applyRateLimit(request, env);

      expect(response).toBeDefined();
      expect(response?.status).toBe(429);
      expect(response?.headers.get('Retry-After')).toBe('30');
      expect(response?.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('checks both IP and token when token is present', async () => {
      const request = new Request('http://localhost/api/books', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'Authorization': 'Bearer test-token',
        },
      });

      vi.mocked(checkRateLimitDO)
        .mockResolvedValueOnce({
          allowed: true,
          remaining: 59,
          resetAt: Date.now() + 60000,
        })
        .mockResolvedValueOnce({
          allowed: true,
          remaining: 40,
          resetAt: Date.now() + 50000,
        });

      const { metadata } = await applyRateLimit(request, env);

      expect(checkRateLimitDO).toHaveBeenCalledTimes(2);
      expect(checkRateLimitDO).toHaveBeenNthCalledWith(1, env, 'ip:api', '1.2.3.4', expect.any(Object));
      expect(checkRateLimitDO).toHaveBeenNthCalledWith(2, env, 'token:api', 'test-token', expect.any(Object));
      expect(metadata?.remaining).toBe(40);
    });

    it('returns 429 when token limit exceeded', async () => {
      const request = new Request('http://localhost/api/books', {
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'Authorization': 'Bearer test-token',
        },
      });

      vi.mocked(checkRateLimitDO)
        .mockResolvedValueOnce({
          allowed: true,
          remaining: 59,
          resetAt: Date.now() + 60000,
        })
        .mockResolvedValueOnce({
          allowed: false,
          remaining: 0,
          resetAt: Date.now() + 20000,
        });

      const { response } = await applyRateLimit(request, env);

      expect(response).toBeDefined();
      expect(response?.status).toBe(429);
      expect(response?.headers.get('Retry-After')).toBe('20');
    });
  });
});
