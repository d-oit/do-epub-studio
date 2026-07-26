import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/observability', () => ({
  createRequestContext: vi.fn((req: Request) => ({
    traceId: 'trace-123',
    spanId: 'span-456',
    startedAt: Date.now(),
    method: req.method,
    path: new URL(req.url).pathname,
  })),
  logRequestStart: vi.fn(),
  logRequestEnd: vi.fn(),
  logRequestError: vi.fn(),
  withTraceHeaders: vi.fn((_res, _ctx) => {
    // Simulate header setting
    return _res;
  }),
}));

import { observabilityMiddleware } from '../middleware/observability';
import {
  createRequestContext,
  logRequestStart,
  logRequestEnd,
  logRequestError,
  withTraceHeaders,
} from '../lib/observability';

function makeContext(overrides: Record<string, unknown> = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const res = new Response('ok', { status: 200 });
  return {
    req: {
      raw: new Request('https://test.example.com/api/books', { headers }),
      routePath: '/api/books',
    },
    res,
    json: vi.fn((_body: unknown, status = 200) => {
      return new Response(JSON.stringify(_body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
    next: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('observabilityMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls createRequestContext and logRequestStart', async () => {
    const ctx = makeContext();
    await observabilityMiddleware(ctx as any, ctx.next as any);

    expect(createRequestContext).toHaveBeenCalledWith(ctx.req.raw);
    expect(logRequestStart).toHaveBeenCalled();
  });

  it('calls next() and logs request end on success', async () => {
    const ctx = makeContext();
    await observabilityMiddleware(ctx as any, ctx.next as any);

    expect(ctx.next).toHaveBeenCalled();
    expect(logRequestEnd).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'trace-123' }),
      200,
      { route: '/api/books' },
    );
  });

  it('sets trace headers on successful response', async () => {
    const ctx = makeContext();
    await observabilityMiddleware(ctx as any, ctx.next as any);

    expect(withTraceHeaders).toHaveBeenCalledWith(ctx.res, expect.objectContaining({ traceId: 'trace-123' }));
  });

  it('catches errors and returns 500 JSON response', async () => {
    const error = new Error('something broke');
    const next = vi.fn().mockRejectedValue(error);
    const ctx = makeContext({ next });

    const result = await observabilityMiddleware(ctx as any, next as any);

    expect(logRequestError).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'trace-123' }),
      error,
    );
    expect(result).toBeInstanceOf(Response);
  });

  it('logs request end with 500 status on error', async () => {
    const next = vi.fn().mockRejectedValue(new Error('fail'));
    const ctx = makeContext({ next });

    await observabilityMiddleware(ctx as any, next as any);

    expect(logRequestEnd).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'trace-123' }),
      500,
      { route: '/api/books' },
    );
  });

  it('returns trace headers on error response', async () => {
    const next = vi.fn().mockRejectedValue(new Error('fail'));
    const ctx = makeContext({ next });

    await observabilityMiddleware(ctx as any, next as any);

    expect(withTraceHeaders).toHaveBeenLastCalledWith(
      expect.any(Response),
      expect.objectContaining({ traceId: 'trace-123' }),
    );
  });

  it('error response body contains traceId', async () => {
    const next = vi.fn().mockRejectedValue(new Error('fail'));
    const ctx = makeContext({ next });

    const result = await observabilityMiddleware(ctx as any, next as any);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const body = await result!.json();

    expect(body).toMatchObject({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        traceId: 'trace-123',
      },
    });
  });
});
