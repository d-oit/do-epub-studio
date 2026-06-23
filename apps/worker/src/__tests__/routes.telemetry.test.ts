import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../app';

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
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    // console.log is called by observabilityMiddleware for request start,
    // and by telemetry router for each log entry.
    expect(console.log).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();

    const clientTelemetryLogs = (console.log as any).mock.calls
      .map((call: any[]) => call[0])
      .filter((msg: string) => msg.startsWith('[CLIENT-TELEMETRY]'));

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
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
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
});
