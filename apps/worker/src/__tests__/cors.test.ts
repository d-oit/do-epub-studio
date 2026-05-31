import { describe, it, expect } from 'vitest';
import worker from '../index';
import { TRACE_HEADER, SPAN_HEADER } from '@do-epub-studio/shared';
import type { Env } from '../lib/env';

describe('CORS', () => {

  const mockBucket: any = {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve({
      key: '',
      httpEtag: '',
      writeHttpMetadata: () => {},
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    }),
    delete: () => Promise.resolve(),
    list: () => Promise.resolve({ objects: [], truncated: false, delimitedPrefixes: [] }),
  };

  const env: Env = {
    APP_BASE_URL: 'https://app.example.com',
    BOOKS_BUCKET: mockBucket,
    TURSO_DATABASE_URL: '',
    TURSO_AUTH_TOKEN: '',
    SESSION_SIGNING_SECRET: '',
    INVITE_TOKEN_SECRET: '',
    RATE_LIMITER: {} as any,
  };

  it('restricts Access-Control-Allow-Origin to APP_BASE_URL for non-matching origin', async () => {
    const request = new Request('https://api.example.com/api/books', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://malicious.com',
      },
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(env.APP_BASE_URL);
  });

  it('allows Access-Control-Allow-Origin when it matches APP_BASE_URL', async () => {
    const request = new Request('https://api.example.com/api/books', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://app.example.com',
      },
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
  });

  it('includes telemetry headers in Access-Control-Allow-Headers', async () => {
    const request = new Request('https://api.example.com/api/books', {
      method: 'OPTIONS',
    });

    const response = await worker.fetch(request, env);
    const allowedHeaders = response.headers.get('Access-Control-Allow-Headers');
    expect(allowedHeaders).toContain(TRACE_HEADER);
    expect(allowedHeaders).toContain(SPAN_HEADER);
  });

  it('sets Vary header to include Origin and Access-Control-Request-Headers', async () => {
    const request = new Request('https://api.example.com/api/books', {
      method: 'OPTIONS',
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Vary')).toBe('Origin, Access-Control-Request-Headers');
  });

  it('fallbacks to APP_BASE_URL when no Origin header is present', async () => {
    const request = new Request('https://api.example.com/api/books', {
      method: 'OPTIONS',
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(env.APP_BASE_URL);
  });

  it('sets Access-Control-Allow-Methods for OPTIONS preflight', async () => {
    const request = new Request('https://api.example.com/api/books', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.example.com' },
    });

    const response = await worker.fetch(request, env);
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, PATCH, DELETE, OPTIONS');
  });
});
