import type { Env } from './env';
import { checkRateLimitDO, type RateLimitConfig, type RateLimitResult } from './rate-limit-client';

/**
 * D1-backed fallback for deployments without the Rate Limiter Durable Object.
 * The invite token has high entropy, but this preserves the intended abuse
 * bound on Cloudflare Pages where the DO binding is unavailable.
 */
export async function checkRateLimit(
  env: Env,
  namespace: string,
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const bucketKey = `${namespace}:${key}`;
  const distributed = env.RATE_LIMITER
    ? await checkRateLimitDO(env, namespace, key, config)
    : { allowed: true, remaining: 0, resetAt: 0 };
  if (distributed.resetAt !== 0) return distributed;

  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  await env.DB.prepare(
    `INSERT INTO rate_limit_buckets (bucket_key, window_started_at, request_count)
     VALUES (?, ?, 1)
     ON CONFLICT(bucket_key) DO UPDATE SET
       request_count = CASE
         WHEN rate_limit_buckets.window_started_at = excluded.window_started_at
         THEN rate_limit_buckets.request_count + 1
         ELSE 1
       END,
       window_started_at = excluded.window_started_at`,
  )
    .bind(bucketKey, windowStart)
    .run();
  const row = await env.DB.prepare(
    `SELECT request_count FROM rate_limit_buckets WHERE bucket_key = ? LIMIT 1`,
  )
    .bind(bucketKey)
    .first<{ request_count: number }>();
  const count = row?.request_count ?? 1;
  return {
    allowed: count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt: windowStart + config.windowMs,
  };
}
