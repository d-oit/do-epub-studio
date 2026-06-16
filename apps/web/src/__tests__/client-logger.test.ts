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
