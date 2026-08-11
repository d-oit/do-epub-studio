import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect, vi } from 'vitest';
import {
  redactLog,
  swLogEvent,
  REDACTED,
  TRACEPARENT_HEADER,
  TRACE_ID_HEADER,
} from '../sw-logger';

const swPath = join(__dirname, '../sw.ts');
const swContent = readFileSync(swPath, 'utf-8');

describe('sw-logger – redactLog', () => {
  it('redacts a value whose KEY matches the sensitive pattern', () => {
    const out = redactLog({ token: 'abc123', event: 'sw.sync.failed' });
    expect(out.token).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('abc123');
  });

  it('redacts a value that itself matches the sensitive pattern (Bearer header)', () => {
    const out = redactLog({ authorization: 'Bearer secret-token-value' });
    expect(out.authorization).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toMatch(/secret-token-value|Bearer/i);
  });

  it('strips the query string from URL-like values', () => {
    const out = redactLog({ url: 'https://example.com/file?token=s3cr3t&x=1' });
    expect(out.url).toBe('https://example.com/file');
    expect(JSON.stringify(out)).not.toContain('s3cr3t');
  });

  it('strips the fragment with an embedded access token from URLs', () => {
    const out = redactLog({ redirect: 'https://app.example/cb#access_token=abc' });
    expect(out.redirect).toBe('https://app.example/cb');
    expect(JSON.stringify(out)).not.toContain('abc');
  });

  it('redacts a secret value even when the key is generic', () => {
    const out = redactLog({ value: 'super-secret-api-key-xyz' });
    expect(out.value).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('secret-api-key-xyz');
  });

  it('leaves benign values untouched', () => {
    const out = redactLog({ event: 'sw.sync.complete', tag: 'sync-reader-state', syncTimeMs: 12 });
    expect(out.event).toBe('sw.sync.complete');
    expect(out.syncTimeMs).toBe(12);
  });

  it('recursively redacts nested object payloads', () => {
    const out = redactLog({ error: { message: 'boom', apiKey: 'abc' } });
    expect((out.error as Record<string, unknown>).apiKey).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain('abc');
  });
});

describe('sw-logger – swLogEvent', () => {
  it('emits a redacted JSON line to the injected sink', () => {
    const sink = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    swLogEvent('error', 'sw.sync.failed', { token: 'topsecret' }, { sink });
    const line = sink.error.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe('sw.sync.failed');
    expect(parsed.level).toBe('error');
    expect(parsed.token).toBe(REDACTED);
    expect(line).not.toContain('topsecret');
  });

  it('does not throw when logging an object that would fail nothing', () => {
    const sink = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    expect(() =>
      swLogEvent('warning', 'sw.storage.quota_warning', { usage: 1 }, { sink }),
    ).not.toThrow();
    expect(sink.warn).toHaveBeenCalledTimes(1);
  });

  it('propagates a traceparent from the initiating request headers', () => {
    const sink = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const request = {
      headers: { get: (name: string) => (name === TRACEPARENT_HEADER ? '00-abc-01' : null) },
    };
    swLogEvent('info', 'sw.sync.start', {}, { request, sink });
    const parsed = JSON.parse(sink.log.mock.calls[0][0] as string);
    expect(parsed.traceHeader).toBe('00-abc-01');
  });

  it('falls back to x-trace-id when traceparent is absent', () => {
    const sink = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const request = {
      headers: { get: (name: string) => (name === TRACE_ID_HEADER ? 'trace-42' : null) },
    };
    swLogEvent('info', 'sw.sync.complete', {}, { request, sink });
    const parsed = JSON.parse(sink.log.mock.calls[0][0] as string);
    expect(parsed.traceHeader).toBe('trace-42');
  });

  it('omits the trace field when no request headers are in scope', () => {
    const sink = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    swLogEvent('info', 'sw.sync.start', {}, { sink });
    const parsed = JSON.parse(sink.log.mock.calls[0][0] as string);
    expect(parsed).not.toHaveProperty('traceHeader');
  });
});

describe('sw.ts – observability wiring (source-level invariants)', () => {
  it('installs a self error handler that logs redacted JSON without rethrowing', () => {
    expect(swContent).toContain("self.addEventListener('error',");
    expect(swContent).toContain("swLogEvent('error', 'sw.global.error',");
  });

  it('installs a self unhandledrejection handler', () => {
    expect(swContent).toContain("self.addEventListener('unhandledrejection',");
    expect(swContent).toContain("'sw.global.unhandledrejection'");
  });

  it('replaces inline console/JSON.stringify logging with the redacted logger', () => {
    // The anonymous inline logs for sync/cache lifecycle are gone.
    expect(swContent).not.toContain("console.log(\n            JSON.stringify({ level: 'info', traceId, event: 'sw.sync.start'");
    expect(swContent).not.toContain("console.error(\n            JSON.stringify({");
  });

  it('logs sw.sync.failed BEFORE rethrowing the retryable failure', () => {
    const failedIdx = swContent.indexOf("'sw.sync.failed'");
    const throwIdx = swContent.indexOf('throw error;');
    expect(failedIdx).toBeGreaterThan(-1);
    expect(throwIdx).toBeGreaterThan(-1);
    // The sync-failed log statement precedes the rethrow.
    expect(failedIdx).toBeLessThan(throwIdx);
  });

  it('keeps the sync success path emitting sw.sync.complete', () => {
    expect(swContent).toContain("'sw.sync.complete'");
  });
});
