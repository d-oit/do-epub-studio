import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

function createMockExecutionCtx() {
  return { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };
}

function assertOk(body: unknown): asserts body is { ok: true } {
  expect(body).toHaveProperty('ok', true);
}

function assertError(body: unknown): asserts body is { ok: false; error: { code: string; message: string } } {
  expect(body).toHaveProperty('ok', false);
}

describe('Telemetry API', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should accept valid telemetry logs', async () => {
    const payload = {
      logs: [
        {
          level: 'info',
          traceId: 'trace-123',
          event: 'test_event',
          metadata: { foo: 'bar' },
        },
        {
          level: 'error',
          traceId: 'trace-456',
          event: 'error_event',
          error: {
            name: 'Error',
            message: 'something went wrong',
            stack: 'error stack trace',
          },
        },
      ],
    };

    const ctx = createMockExecutionCtx();
    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'test-agent',
          'CF-Connecting-IP': '1.2.3.4',
        },
        body: JSON.stringify(payload),
      }),
      {},
      ctx,
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    assertOk(body);

    expect(console.log).toHaveBeenCalled();

    // info-level telemetry routes through logAppInfo → console.log
    const consoleLogs = vi.mocked(console.log).mock.calls
      .map((call: unknown[]) => call[0] as string);
    const infoTelemetryLogs = consoleLogs.filter((msg) => {
      try { return (JSON.parse(msg) as Record<string, unknown>).event === 'telemetry.received'; }
      catch { return false; }
    });
    expect(infoTelemetryLogs.length).toBe(1);
    expect(infoTelemetryLogs[0]).toContain('test_event');

    // error-level telemetry routes through logAppError → console.error
    expect(console.error).toHaveBeenCalled();
    const consoleErrors = vi.mocked(console.error).mock.calls
      .map((call: unknown[]) => call[0] as string);
    const errorTelemetryLogs = consoleErrors.filter((msg) => {
      try { return (JSON.parse(msg) as Record<string, unknown>).event === 'telemetry.received'; }
      catch { return false; }
    });
    expect(errorTelemetryLogs.length).toBe(1);
    expect(errorTelemetryLogs[0]).toContain('error_event');
  });

  it('should reject invalid payloads', async () => {
    const payload = {
      logs: [
        {
          level: 'invalid-level',
          traceId: 'trace-123',
          event: 'test_event',
        },
      ],
    };

    const ctx = createMockExecutionCtx();
    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      {},
      ctx,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    assertError(body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject payloads with too many logs', async () => {
    const payload = {
      logs: Array(101).fill({
        level: 'info',
        traceId: 'trace-123',
        event: 'test_event',
      }),
    };

    const ctx = createMockExecutionCtx();
    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      {},
      ctx,
    );

    expect(res.status).toBe(400);
  });

  it('should scrub sensitive information in logs before printing', async () => {
    const payload = {
      logs: [
        {
          level: 'warn',
          traceId: 'trace-sensitive',
          event: 'login_error',
          metadata: {
            password: 'my-super-secret-password-123',
            email: 'admin@example.com',
            token: 'abcdef1234567890abcdef1234567890',
            safeField: 'hello-world',
          },
          error: {
            name: 'Error',
            message: 'Failed for user user@example.com with password secretpwd_but_with_a_very_long_string_of_characters_to_trigger_long_token_pattern',
          },
        },
      ],
    };

    const ctx = createMockExecutionCtx();
    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      {},
      ctx,
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    assertOk(body);

    // warn-level telemetry routes through logAppWarn → console.warn
    expect(console.warn).toHaveBeenCalled();
    const warnLogs = vi.mocked(console.warn).mock.calls
      .map((call: unknown[]) => call[0] as string);
    const telemetryLog = warnLogs.find((msg) => {
      try { return (JSON.parse(msg) as Record<string, unknown>).event === 'telemetry.received'; }
      catch { return false; }
    });
    expect(telemetryLog).toBeDefined();
    if (!telemetryLog) return;

    const parsedLog = JSON.parse(telemetryLog);
    const logString = JSON.stringify(parsedLog);

    // Verify sensitive data is scrubbed anywhere in the log output
    expect(logString).not.toContain('my-super-secret-password-123');
    expect(logString).not.toContain('admin@example.com');
    expect(logString).not.toContain('abcdef1234567890abcdef1234567890');
    expect(logString).not.toContain('user@example.com');
    expect(logString).not.toContain('secretpwd_but_with_a_very_long_string_of_characters_to_trigger_long_token_pattern');
    expect(logString).toContain('[REDACTED]');
  });

  it('should emit telemetry.persistence.failed on DB error and still return 202', async () => {
    const mockExecute = vi.fn().mockRejectedValue(new Error('DB connection lost'));
    vi.doMock('../db/client', () => ({ execute: mockExecute }));

    const { app: freshApp } = await import('../app');

    const payload = {
      logs: [
        { level: 'info', traceId: 'trace-db-fail', event: 'test_persist_fail', metadata: { key: 'val' } },
      ],
    };

    const ctx = createMockExecutionCtx();
    const res = await freshApp.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      { DB: { prepare: vi.fn().mockReturnThis(), bind: vi.fn().mockReturnThis(), all: vi.fn() } },
      ctx,
    );

    expect(res.status).toBe(202);

    // Allow microtasks to flush for the waitUntil promise
    await new Promise((r) => setTimeout(r, 10));

    expect(console.warn).toHaveBeenCalled();
    const warnLogs = vi.mocked(console.warn).mock.calls
      .map((call: unknown[]) => call[0] as string);
    const failureLog = warnLogs.find((msg) => {
      try { return (JSON.parse(msg) as Record<string, unknown>).event === 'telemetry.persistence.failed'; }
      catch { return false; }
    });
    expect(failureLog).toBeDefined();

    const parsed = JSON.parse(failureLog ?? '{}');
    expect(parsed.metadata).toMatchObject({ event: 'test_persist_fail', level: 'info' });
    expect(parsed.metadata.errorMessage).toContain('DB connection lost');

    vi.doUnmock('../db/client');
  });
});
