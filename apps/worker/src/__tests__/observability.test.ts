import { describe, it, expect, vi, afterEach } from 'vitest';
import { TRACE_HEADER, SPAN_HEADER, TRACEPARENT_HEADER } from '@do-epub-studio/shared';
import {
  createRequestContext,
  logAppError,
  logAppInfo,
  logAppWarn,
  logRequestError,
  logRequestStart,
  withTraceHeaders,
} from '../lib/observability';

// Plan 214 R2: inbound trace/span headers are client-controlled input and must
// be bounded/validated before being accepted or echoed. Plan 214 R3: background
// log helpers inherit the initiating request's trace ids when context is passed.

function makeRequest(headers: Record<string, string>): Request {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return new Request('https://test.example.com/api', { headers: h });
}

describe('createRequestContext (Plan 214 R2)', () => {
  it('mints server ids when headers are absent', () => {
    const ctx = createRequestContext(makeRequest({}));
    expect(ctx.traceId).toMatch(/^[0-9a-fA-F-]+$/);
    expect(ctx.spanId).toMatch(/^[0-9a-fA-F-]+$/);
  });

  it('accepts a valid bounded trace header verbatim', () => {
    const traceId = '550e8400-e29b-41d4-a716-446655440000';
    const spanId = '44e83a0f';
    const ctx = createRequestContext(
      makeRequest({ [TRACE_HEADER]: traceId, [SPAN_HEADER]: spanId }),
    );
    expect(ctx.traceId).toBe(traceId);
    expect(ctx.spanId).toBe(spanId);
  });

  it('mints a server id for an oversized trace header', () => {
    const huge = 'a'.repeat(10_000);
    const ctx = createRequestContext(makeRequest({ [TRACE_HEADER]: huge }));
    // Server id must be valid and bounded, never the 10kB client blob.
    expect(ctx.traceId).not.toBe(huge);
    expect(ctx.traceId.length).toBeLessThanOrEqual(64);
    expect(ctx.traceId).toMatch(/^[0-9a-fA-F-]+$/);
  });

  it('mints a server id for an invalid-charset trace header', () => {
    const xssPayload =
      String.fromCharCode(60) +
      'script' +
      String.fromCharCode(62) +
      'alert(1)' +
      String.fromCharCode(60) +
      '/script' +
      String.fromCharCode(62);
    const ctx = createRequestContext(makeRequest({ [TRACE_HEADER]: xssPayload }));
    expect(ctx.traceId).not.toBe(xssPayload);
    expect(ctx.traceId).toMatch(/^[0-9a-fA-F-]+$/);
  });

  it('never echoes an invalid client span id into the response headers', () => {
    const ctx = createRequestContext(makeRequest({ [SPAN_HEADER]: '!!!not-a-span!!!' }));
    const res = withTraceHeaders(new Response('ok', { status: 200 }), ctx);
    const echoed = res.headers.get(TRACE_HEADER);
    const parent = res.headers.get(TRACEPARENT_HEADER);
    expect(echoed).toMatch(/^[0-9a-fA-F-]+$/);
    expect(parent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});

describe('background log helpers (Plan 214 R3 / A6 GOAP-298)', () => {
  const TRACE_ID = '550e8400-e29b-41d4-a716-446655440000';
  const SPAN_ID = '44e83a0f';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureLogs(): { info: string[]; error: string[]; warn: string[] } {
    const info: string[] = [];
    const error: string[] = [];
    const warn: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((m: string) => info.push(m));
    vi.spyOn(console, 'error').mockImplementation((m: string) => error.push(m));
    vi.spyOn(console, 'warn').mockImplementation((m: string) => warn.push(m));
    return { info, error, warn };
  }

  // A6: structural correlation ids are preserved at the log boundary even
  // though their UUID format would otherwise match the long-token scrub
  // pattern. The old expectation pinned the erased correlation and had to pass
  // SHORT ids to bypass the scrubber — that pinning is intentionally gone.
  it('inherits real-format request trace ids when context is supplied', () => {
    const { error } = captureLogs();
    logAppError('test.event', new Error('boom'), { k: 1 }, { traceId: TRACE_ID, spanId: SPAN_ID });
    const parsed = JSON.parse(error[0] ?? '{}') as { traceId: string; spanId: string };
    expect(parsed.traceId).toBe(TRACE_ID);
    expect(parsed.spanId).toBe(SPAN_ID);
  });

  it('mints visible real-format ids when no context is supplied', () => {
    const { info } = captureLogs();
    logAppInfo('test.event', {});
    const parsed = JSON.parse(info[0] ?? '{}') as { traceId: string; spanId: string };
    expect(parsed.traceId).toMatch(/^[0-9a-fA-F-]{1,64}$/);
    expect(parsed.spanId).toMatch(/^[0-9a-fA-F-]{1,32}$/);
  });

  it('keeps request/error log ids equal to the response trace headers', () => {
    const ctx = createRequestContext(
      makeRequest({ [TRACE_HEADER]: TRACE_ID, [SPAN_HEADER]: SPAN_ID }),
    );
    const response = withTraceHeaders(new Response('ok', { status: 200 }), ctx);
    const { info, error } = captureLogs();
    logRequestStart(ctx);
    logRequestError(ctx, new Error('boom'));
    const start = JSON.parse(info[0] ?? '{}') as { traceId: string; spanId: string };
    const err = JSON.parse(error[0] ?? '{}') as { traceId: string; spanId: string };
    expect(start.traceId).toBe(response.headers.get(TRACE_HEADER));
    expect(err.traceId).toBe(response.headers.get(TRACE_HEADER));
    expect(start.spanId).toBe(response.headers.get(SPAN_HEADER));
    expect(err.spanId).toBe(response.headers.get(SPAN_HEADER));
  });

  it('still redacts secrets, including identifier-shaped values outside correlation fields', () => {
    const { info } = captureLogs();
    logAppInfo(
      'test.event',
      {
        password: 'hunter2',
        apiKey: 'a'.repeat(40),
        note: 'c'.repeat(40),
        contact: 'reader@example.test',
      },
      { traceId: TRACE_ID, spanId: SPAN_ID },
    );
    const parsed = JSON.parse(info[0] ?? '{}') as {
      traceId: string;
      metadata: Record<string, unknown>;
    };
    expect(parsed.traceId).toBe(TRACE_ID);
    expect(parsed.metadata.password).toBe('[REDACTED]');
    expect(parsed.metadata.apiKey).toBe('[REDACTED]');
    expect(parsed.metadata.note).toBe('[REDACTED]');
    expect(parsed.metadata.contact).toBe('[REDACTED]');
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('reader@example.test');
  });

  it('preserves ingest/client correlation ids inside background metadata', () => {
    const { warn } = captureLogs();
    logAppWarn(
      'telemetry.received',
      {
        ingestTraceId: TRACE_ID,
        clientTraceId: 'd'.repeat(32),
        details: 'e'.repeat(40),
      },
      { traceId: TRACE_ID, spanId: SPAN_ID },
    );
    const parsed = JSON.parse(warn[0] ?? '{}') as { metadata: Record<string, unknown> };
    expect(parsed.metadata.ingestTraceId).toBe(TRACE_ID);
    expect(parsed.metadata.clientTraceId).toBe('d'.repeat(32));
    expect(parsed.metadata.details).toBe('[REDACTED]');
  });

  it('warn helper inherits context', () => {
    const { warn } = captureLogs();
    logAppWarn('test.warn', { x: 1 }, { traceId: TRACE_ID, spanId: SPAN_ID });
    const parsed = JSON.parse(warn[0] ?? '{}') as { traceId: string; spanId: string };
    expect(parsed.traceId).toBe(TRACE_ID);
    expect(parsed.spanId).toBe(SPAN_ID);
  });
});
