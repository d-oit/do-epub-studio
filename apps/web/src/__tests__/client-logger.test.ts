import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logClientEvent, createPerformanceMark, measurePerformance } from '../lib/client-logger';

describe('logClientEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs warn events', () => {
    logClientEvent({
      level: 'warn',
      traceId: 'trace-1',
      event: 'test-warn',
    });
    expect(console.warn).toHaveBeenCalled();
  });

  it('logs error events', () => {
    logClientEvent({
      level: 'error',
      traceId: 'trace-1',
      event: 'test-error',
      error: { name: 'Error', message: 'test' },
    });
    expect(console.error).toHaveBeenCalled();
  });

  it('does not log debug events when min level is warn', () => {
    logClientEvent({
      level: 'debug',
      traceId: 'trace-1',
      event: 'test-debug',
    });
    expect(console.log).not.toHaveBeenCalled();
  });

  it('caps buffer at MAX_BUFFER_SIZE (100 entries)', async () => {
    // The telemetry endpoint must be available so flushBuffer() actually
    // sends rather than silently clearing the buffer.
    // vi.stubEnv sets process.env which Vitest's import.meta.env proxy reads.
    vi.stubEnv('VITE_TELEMETRY_ENDPOINT', 'https://example.com/telemetry');

    // Mock sendBeacon on the real navigator
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      writable: true,
      configurable: true,
    });

    // Log 110 warn entries — buffer should cap at 100
    for (let i = 0; i < 110; i++) {
      logClientEvent({
        level: 'warn',
        traceId: `trace-${i}`,
        event: `test-event-${i}`,
      });
    }

    // All 110 entries pass the level filter and log to console
    expect(console.warn).toHaveBeenCalledTimes(110);

    // Wait for the flush timer (1000 ms) to fire naturally
    await new Promise((r) => setTimeout(r, 1200));

    // sendBeacon was called with a Blob containing at most 100 log entries
    expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    const sentBlob = sendBeaconSpy.mock.calls[0][1] as Blob;
    const payload = JSON.parse(await sentBlob.text());
    expect(payload.logs.length).toBeLessThanOrEqual(100);
  });
});

describe('createPerformanceMark', () => {
  it('creates performance mark', () => {
    const mockMark = vi.fn();
    vi.stubGlobal('performance', { mark: mockMark });
    createPerformanceMark('test-mark');
    expect(mockMark).toHaveBeenCalledWith('test-mark');
    vi.unstubAllGlobals();
  });
});

describe('measurePerformance', () => {
  it('returns undefined when performance not available', () => {
    vi.stubGlobal('performance', undefined);
    const result = measurePerformance('test', 'start', 'end');
    expect(result).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('measures performance', () => {
    const mockMeasure = vi.fn();
    const mockGetEntriesByName = vi.fn().mockReturnValue([{ duration: 100 }]);
    vi.stubGlobal('performance', {
      measure: mockMeasure,
      getEntriesByName: mockGetEntriesByName,
    });
    const result = measurePerformance('test', 'start', 'end');
    expect(result).toBe(100);
    vi.unstubAllGlobals();
  });

  it('returns undefined on error', () => {
    vi.stubGlobal('performance', {
      measure: vi.fn().mockImplementation(() => { throw new Error('fail'); }),
      getEntriesByName: vi.fn(),
    });
    const result = measurePerformance('test', 'start', 'end');
    expect(result).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
