import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  TRACE_HEADER,
  SPAN_HEADER,
  TRACEPARENT_HEADER,
} from '@do-epub-studio/shared';
import {
  createRequestContext,
  logAppError,
  logAppInfo,
  logAppWarn,
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
    const xssPayload = String.fromCharCode(60) + 'script' + String.fromCharCode(62) + 'alert(1)' + String.fromCharCode(60) + '/script' + String.fromCharCode(62);
    const ctx = createRequestContext(makeRequest({ [TRACE_HEADER]: xssPayload }));
    expect(ctx.traceId).not.toBe(xssPayload);
    expect(ctx.traceId).toMatch(/^[0-9a-fA-F-]+$/);
  });

  it('never echoes an invalid client span id into the response headers', () => {
    const ctx = createRequestContext(
      makeRequest({ [SPAN_HEADER]: '!!!not-a-span!!!' }),
    );
    const res = withTraceHeaders(new Response('ok', { status: 200 }), ctx);
    const echoed = res.headers.get(TRACE_HEADER);
    const parent = res.headers.get(TRACEPARENT_HEADER);
    expect(echoed).toMatch(/^[0-9a-fA-F-]+$/);
    expect(parent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });
});

describe('background log helpers (Plan 214 R3)', () => {
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

  // NOTE: the log layer scrubs 32+ char hex runs to [REDACTED], so a real
  // minted UUID traceId is never visible in log output. To prove inheritance
  // we pass a SHORT context id ("abc123") which survives scrubbing, then
  // assert it appears verbatim. A no-context call mints a UUID that is
  // redacted, proving the helper did not use a short caller-supplied id.
  it('inherits the request trace ids when context is supplied', () => {
    const { error } = captureLogs();
    logAppError('test.event', new Error('boom'), { k: 1 }, { traceId: 'abc123', spanId: 'sfx1' });
    const parsed = JSON.parse(error[0] ?? '{}') as { traceId: string; spanId: string };
    expect(parsed.traceId).toBe('abc123');
    expect(parsed.spanId).toBe('sfx1');
  });

  it('mints fresh ids when no context is supplied', () => {
    const { info } = captureLogs();
    logAppInfo('test.event', {});
    const parsed = JSON.parse(info[0] ?? '{}') as { traceId: string; spanId: string };
    // Minted traceId is a UUID → long → redacted; proves no short caller id
    // leaked in. spanId is created as a short 8-char segment and survives.
    expect(parsed.traceId).toBe('[REDACTED]');
    expect(parsed.spanId).toMatch(/^[0-9a-fA-F-]+$/);
  });

  it('warn helper inherits context', () => {
    const { warn } = captureLogs();
    logAppWarn('test.warn', { x: 1 }, { traceId: 't1', spanId: 's1' });
    const parsed = JSON.parse(warn[0] ?? '{}') as { traceId: string; spanId: string };
    expect(parsed.traceId).toBe('t1');
    expect(parsed.spanId).toBe('s1');
  });
});