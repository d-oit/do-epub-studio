import { describe, it, expect, vi } from 'vitest';
import type { Env, R2Bucket } from '../lib/env';

// Mock responses.ts to simplify testing
vi.mock('../lib/responses', () => ({
  jsonResponse: (data: unknown, options: unknown) => {
    const resolvedOptions = typeof options === 'number' ? { status: options } : ((options as Record<string, unknown>) ?? {});
    const status = resolvedOptions.status as number || 200;
    const headers = new Headers(resolvedOptions.headers as HeadersInit);
    return new Response(JSON.stringify(data), { status, headers });
  }
}));

// Mock security headers to avoid dependency issues
vi.mock('../lib/security-headers', () => ({
  applySecurityHeaders: (res: Response) => res,
  applyMinimalSecurityHeaders: (res: Response) => res,
}));

// Mock db client to prevent fetch failures
vi.mock('../db/client', () => ({
  queryFirst: vi.fn().mockResolvedValue({}),
  queryAll: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue({}),
}));

import worker from '../index';

describe('CORS', () => {
  const env: Env = {
    APP_BASE_URL: 'https://app.example.com',
    BOOKS_BUCKET: {} as unknown as R2Bucket,
    TURSO_DATABASE_URL: 'http://localhost:8080',
    TURSO_AUTH_TOKEN: 'test',
    SESSION_SIGNING_SECRET: 'test',
    INVITE_TOKEN_SECRET: 'test',
  };

  it('allows origin that matches APP_BASE_URL', async () => {
    const request = new Request('https://api.example.com/api/access/request', {
      method: 'POST',
      headers: {
        'Origin': 'https://app.example.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bookSlug: 'test', email: 'test@example.com' })
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response.headers.get('Vary')).toContain('Origin');
  });

  it('falls back to APP_BASE_URL for non-matching origin', async () => {
    const request = new Request('https://api.example.com/api/access/request', {
      method: 'POST',
      headers: {
        'Origin': 'https://malicious.com',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bookSlug: 'test', email: 'test@example.com' })
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });

  it('allows OPTIONS request with correct headers', async () => {
    const request = new Request('https://api.example.com/api/access/request', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://app.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });

    const response = await worker.fetch(request, env);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
  });

  it('handles missing Origin header by falling back to APP_BASE_URL', async () => {
    const request = new Request('https://api.example.com/api/access/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bookSlug: 'test', email: 'test@example.com' })
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });
});
