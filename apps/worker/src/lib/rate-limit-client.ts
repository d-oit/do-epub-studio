import { createTraceId } from '@do-epub-studio/shared';
import type { Env } from './env';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Checks a rate limit using the distributed Durable Object-based rate limiter.
 * This ensures rate limiting is consistent across multiple Worker instances.
 */
export async function checkRateLimitDO(
  env: Env,
  namespace: string,
  key: string,
  config?: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const id = env.RATE_LIMITER.idFromName(namespace);
    const obj = env.RATE_LIMITER.get(id);

    const url = new URL(`http://rate-limiter/check/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`);
    if (config) {
      url.searchParams.set('maxRequests', String(config.maxRequests));
      url.searchParams.set('windowMs', String(config.windowMs));
    }

    const response = await obj.fetch(url.toString());

    if (!response.ok) {
      // Defense in depth: if the rate limiter DO fails, we allow the request
      // to ensure system availability, but we lose rate limiting protection.
      return { allowed: true, remaining: 0, resetAt: 0 };
    }

    return await response.json<RateLimitResult>();
  } catch (error) {
    // If anything fails (e.g. DO unreachable), fail open to maintain availability.
    console.error(JSON.stringify({ level: 'error', traceId: createTraceId(), event: 'rate_limit_client.error', error: error instanceof Error ? error.message : String(error) }));
    return { allowed: true, remaining: 0, resetAt: 0 };
  }
}
