import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logThrottled, type ClientLogEntry } from './client-logger';

describe('logThrottled', () => {
  const entry: ClientLogEntry = {
    level: 'warn',
    traceId: 'trace-1',
    event: 'notifications.poll_failed',
    error: { name: 'PollError', message: 'boom' },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('emits on first call, suppresses within the interval, emits again after', () => {
    const intervalMs = 60_000;
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    expect(logThrottled('poll', entry, intervalMs)).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(1);

    // Immediate repeat within the interval — suppressed, no new emission.
    expect(logThrottled('poll', entry, intervalMs)).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);

    // Still within the interval.
    vi.setSystemTime(new Date('2026-01-01T00:00:59Z'));
    expect(logThrottled('poll', entry, intervalMs)).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(1);

    // Interval elapsed — emits again.
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z')); // exactly +60s → 0 < 60s is false
    expect(logThrottled('poll', entry, intervalMs)).toBe(true);
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'));
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('tracks distinct keys independently', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    expect(logThrottled('key-a', entry)).toBe(true);
    expect(logThrottled('key-b', entry)).toBe(true);
    expect(logThrottled('key-a', entry)).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
});
