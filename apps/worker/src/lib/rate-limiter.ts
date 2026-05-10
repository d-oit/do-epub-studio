/**
 * Rate Limiter using Cloudflare KV storage
 * Implements sliding window rate limiting to prevent brute force and DoS attacks
 */

import type { Env } from './env';

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in current window */
  remaining: number;
  /** Seconds until the window resets */
  resetAt: number;
  /** Retry-After header value (if rate limited) */
  retryAfter?: number;
}

// Default configurations
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for authentication endpoints
  AUTH: {
    maxRequests: 5,
    windowSeconds: 60, // 5 requests per minute
  } as RateLimitConfig,

  // Moderate limits for general API endpoints
  API: {
    maxRequests: 10,
    windowSeconds: 60, // 10 requests per minute
  } as RateLimitConfig,

  // Lenient limits for read-only endpoints
  READ: {
    maxRequests: 30,
    windowSeconds: 60, // 30 requests per minute
  } as RateLimitConfig,
};

/**
 * Generates a unique key for rate limiting based on IP and endpoint
 */
function generateRateLimitKey(ip: string, endpoint: string): string {
  return `rate_limit:${ip}:${endpoint}`;
}

/**
 * Gets the current timestamp bucket (window-aligned)
 */
function getCurrentBucket(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000 / windowSeconds);
}

/**
 * Checks and updates rate limit for a given IP and endpoint
 * Uses a sliding window counter algorithm
 * 
 * @param env - Worker environment with KV storage
 * @param ip - Client IP address
 * @param endpoint - Endpoint identifier (e.g., '/api/access/request')
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and metadata
 */
export async function checkRateLimit(
  env: Env,
  ip: string,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.API,
): Promise<RateLimitResult> {
  const key = generateRateLimitKey(ip, endpoint);
  const currentBucket = getCurrentBucket(config.windowSeconds);
  const bucketKey = `${key}:${currentBucket}`;
  
  try {
    // Get current count for this bucket
    const currentValue = await env.RATE_LIMIT_KV?.get(bucketKey);
    const count = currentValue ? parseInt(currentValue, 10) : 0;

    if (count >= config.maxRequests) {
      // Rate limit exceeded
      const resetAt = (currentBucket + 1) * config.windowSeconds;
      const retryAfter = resetAt - Math.floor(Date.now() / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Increment counter atomically
    const newCount = count + 1;
    const ttl = config.windowSeconds * 2; // Keep for 2 windows to handle edge cases
    
    await env.RATE_LIMIT_KV?.put(bucketKey, newCount.toString(), {
      expirationTtl: ttl,
    });

    const resetAt = (currentBucket + 1) * config.windowSeconds;
    const remaining = config.maxRequests - newCount;

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    // If KV is not available or fails, allow the request but log warning
    console.error('Rate limiter error:', error);
    
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
    };
  }
}

/**
 * Extracts client IP from request headers
 * Works with Cloudflare's CF-Connecting-IP and standard X-Forwarded-For
 */
export function getClientIP(request: Request): string {
  // Cloudflare provides the real IP in CF-Connecting-IP
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) {
    return cfIp;
  }

  // Fallback to X-Forwarded-For (take first IP if multiple)
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) {
    const ips = xff.split(',').map((ip) => ip.trim());
    return ips[0] ?? 'unknown';
  }

  // Last resort: use remote address (may be proxy IP)
  return 'unknown';
}

/**
 * Creates a rate limit response with proper headers
 */
export function createRateLimitResponse(retryAfter: number): Response {
  const response = new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
      },
    },
  );

  return response;
}

/**
 * Middleware wrapper for rate limiting
 * Returns a response if rate limited, null otherwise
 */
export async function withRateLimit(
  env: Env,
  request: Request,
  endpoint: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.API,
): Promise<Response | null> {
  const ip = getClientIP(request);
  const result = await checkRateLimit(env, ip, endpoint, config);

  if (!result.allowed) {
    return createRateLimitResponse(result.retryAfter!);
  }

  return null;
}
