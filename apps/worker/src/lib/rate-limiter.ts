/**
 * Simple in-memory rate limiter.
 *
 * CAVEAT: This implementation uses an in-process Map and is NOT atomic across
 * multiple Workers. For distributed deployments, migrate to:
 *   - Workers KV with atomic check-and-set (get() + conditional put())
 *   - Durable Objects for strongly-consistent counters
 *
 * KV atomic caveat: KV get() then put() without compare-and-swap can race
 * under concurrent requests. For production multi-instance rate limiting,
 * Durable Objects are the recommended approach.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};

function now(): number {
  return Date.now();
}

export function checkRateLimit(
  namespace: string,
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): { allowed: boolean; remaining: number; resetAt: number } {
  let namespaceStore = stores.get(namespace);
  if (!namespaceStore) {
    namespaceStore = new Map();
    stores.set(namespace, namespaceStore);
  }

  const entryKey = `${namespace}:${key}`;
  const nowMs = now();
  let entry = namespaceStore.get(entryKey);

  if (!entry || nowMs >= entry.resetAt) {
    entry = { count: 1, resetAt: nowMs + config.windowMs };
    namespaceStore.set(entryKey, entry);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return { allowed, remaining, resetAt: entry.resetAt };
}

export function resetRateLimits(namespace?: string): void {
  if (namespace) {
    stores.delete(namespace);
  } else {
    stores.clear();
  }
}
