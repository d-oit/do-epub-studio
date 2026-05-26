import type { Env } from '../lib/env';
import { checkRateLimitDO, type RateLimitConfig } from '../lib/rate-limit-client';
import { jsonResponse } from '../lib/responses';
import { matchBounded } from '@do-epub-studio/shared';

export interface RateLimitMetadata {
  limit: number;
  remaining: number;
  reset: number;
}

const AUTH_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 };
const FILE_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 };
const API_LIMIT: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 };

export function getRateLimitConfig(path: string): { config: RateLimitConfig; category: string } {
  // Auth endpoints
  if (
    path === '/api/access/request' ||
    path === '/api/admin/login' ||
    path === '/api/access/refresh' ||
    path === '/api/admin/logout' ||
    path === '/api/access/logout'
  ) {
    return { config: AUTH_LIMIT, category: 'auth' };
  }

  // File endpoints
  if (path.startsWith('/api/files/') || matchBounded(/\/api\/books\/([^/]+)\/file-url$/, path, 2048)) {
    return { config: FILE_LIMIT, category: 'files' };
  }

  // Default API endpoints
  return { config: API_LIMIT, category: 'api' };
}

export async function applyRateLimit(
  request: Request,
  env: Env,
): Promise<{ response?: Response; metadata?: RateLimitMetadata }> {
  const url = new URL(request.url);
  const path = url.pathname;
  const { config, category } = getRateLimitConfig(path);

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Check IP-based rate limit
  const ipResult = await checkRateLimitDO(env, `ip:${category}`, ip, config);

  const metadata: RateLimitMetadata = {
    limit: config.maxRequests,
    remaining: ipResult.remaining,
    reset: Math.ceil(ipResult.resetAt / 1000),
  };

  if (!ipResult.allowed) {
    return {
      response: jsonResponse(
        {
          ok: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Rate limit exceeded. Please try again later.',
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((ipResult.resetAt - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': metadata.limit.toString(),
            'X-RateLimit-Remaining': metadata.remaining.toString(),
            'X-RateLimit-Reset': metadata.reset.toString(),
          },
        },
      ),
    };
  }

  // Check token-based rate limit if token is present
  if (token) {
    const tokenResult = await checkRateLimitDO(env, `token:${category}`, token, config);

    // Use the more restrictive result for metadata
    metadata.remaining = Math.min(metadata.remaining, tokenResult.remaining);
    metadata.reset = Math.max(metadata.reset, Math.ceil(tokenResult.resetAt / 1000));

    if (!tokenResult.allowed) {
      return {
        response: jsonResponse(
          {
            ok: false,
            error: {
              code: 'TOO_MANY_REQUESTS',
              message: 'Rate limit exceeded. Please try again later.',
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((tokenResult.resetAt - Date.now()) / 1000).toString(),
              'X-RateLimit-Limit': metadata.limit.toString(),
              'X-RateLimit-Remaining': metadata.remaining.toString(),
              'X-RateLimit-Reset': metadata.reset.toString(),
            },
          },
        ),
      };
    }
  }

  return { metadata };
}

export function addRateLimitHeaders(response: Response, metadata: RateLimitMetadata): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-RateLimit-Limit', metadata.limit.toString());
  newResponse.headers.set('X-RateLimit-Remaining', metadata.remaining.toString());
  newResponse.headers.set('X-RateLimit-Reset', metadata.reset.toString());
  return newResponse;
}
