import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

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
      {}
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    assertOk(body);

    expect(console.log).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();

    const clientTelemetryLogs = vi.mocked(console.log).mock.calls
      .map((call: unknown[]) => call[0] as string)
      .filter((msg) => msg.startsWith('[CLIENT-TELEMETRY]'));

    expect(clientTelemetryLogs.length).toBe(1);
    expect(clientTelemetryLogs[0]).toContain('test_event');
    expect(clientTelemetryLogs[0]).toContain('1.2.3.4');
    expect(clientTelemetryLogs[0]).toContain('test-agent');
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

    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      {}
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

    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      {}
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

    const res = await app.fetch(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }),
      {}
    );

    expect(res.status).toBe(202);
    const body = await res.json();
    assertOk(body);

    expect(console.warn).toHaveBeenCalled();

    const clientTelemetryLogs = vi.mocked(console.warn).mock.calls
      .map((call: unknown[]) => call[0] as string)
      .filter((msg) => msg.startsWith('[CLIENT-TELEMETRY]'));

    expect(clientTelemetryLogs.length).toBe(1);
    const parsedLog = JSON.parse(clientTelemetryLogs[0].replace('[CLIENT-TELEMETRY] ', ''));

    // Check metadata redaction
    expect(parsedLog.metadata.password).toBe('[REDACTED]');
    expect(parsedLog.metadata.email).toBe('[REDACTED]');
    expect(parsedLog.metadata.token).toBe('[REDACTED]');
    expect(parsedLog.metadata.safeField).toBe('hello-world');

    // Check error redaction
    expect(parsedLog.error.message).not.toContain('user@example.com');
    expect(parsedLog.error.message).not.toContain('secretpwd_but_with_a_very_long_string_of_characters_to_trigger_long_token_pattern');
    expect(parsedLog.error.message).toContain('[REDACTED]');
  });
});
