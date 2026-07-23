import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout, checkDeadline, createDeadline } from '../timeout';
import { TimeoutError } from '../errors';

describe('Timeout utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('withTimeout', () => {
    it('resolves with the return value when fn completes before timeout', () => {
      const result = withTimeout(() => 'hello', {
        timeoutMs: 1000,
        operation: 'test-op',
      });
      return expect(result).resolves.toBe('hello');
    });

    it('rejects with TimeoutError when fn exceeds timeout', async () => {
      const promise = withTimeout(
        () => new Promise<string>((resolve) => { setTimeout(() => { resolve('late'); }, 10_000); }),
        { timeoutMs: 1, operation: 'slow-op' },
      );
      vi.advanceTimersByTime(1);
      await expect(promise).rejects.toThrow(TimeoutError);
      await expect(promise).rejects.toMatchObject({
        operation: 'slow-op',
        timeoutMs: 1,
      });
    });

    it('propagates fn errors without wrapping in TimeoutError', () => {
      const original = new Error('fn failed');
      const promise = withTimeout(() => {
        throw original;
      }, { timeoutMs: 1000, operation: 'test-op' });
      return expect(promise).rejects.toBe(original);
    });

    it('respects external AbortSignal', async () => {
      const controller = new AbortController();
      const promise = withTimeout(
        (signal) =>
          new Promise<string>((resolve, reject) => {
            signal.addEventListener('abort', () => { reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
            setTimeout(() => { resolve('done'); }, 10_000);
          }),
        { timeoutMs: 10_000, operation: 'test-op', signal: controller.signal },
      );
      controller.abort();
      await expect(promise).rejects.toThrow();
    });

    it('cleans up timer on success', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const promise = withTimeout(() => 'ok', { timeoutMs: 5000, operation: 'test-op' });
      return promise.then(() => {
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
      });
    });

    it('fn receives an AbortSignal', async () => {
      let receivedSignal: AbortSignal | undefined;
      await withTimeout(
        (signal) => {
          receivedSignal = signal;
          return 'done';
        },
        { timeoutMs: 1000, operation: 'test-op' },
      );
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(receivedSignal?.aborted).toBe(false);
    });
  });

  describe('checkDeadline', () => {
    it('does not throw when before deadline', () => {
      const deadline = createDeadline(10_000);
      expect(() => { checkDeadline(deadline, 'test-op', 10_000); }).not.toThrow();
    });

    it('throws TimeoutError when past deadline', () => {
      const deadline = performance.now() - 1;
      expect(() => { checkDeadline(deadline, 'expired-op', 1000); }).toThrow(TimeoutError);
      try {
        checkDeadline(deadline, 'expired-op', 1000);
      } catch (err) {
        expect(err).toMatchObject({ operation: 'expired-op', timeoutMs: 1000 });
      }
    });
  });

  describe('createDeadline', () => {
    it('returns a future performance.now() value', () => {
      const now = performance.now();
      const deadline = createDeadline(1000);
      expect(deadline).toBeGreaterThan(now);
    });
  });

  describe('TimeoutError', () => {
    it('has correct shape', () => {
      const err = new TimeoutError('my-op', 500, 'trace-123');
      expect(err.name).toBe('TimeoutError');
      expect(err.code).toBe('TIMEOUT');
      expect(err.statusCode).toBe(504);
      expect(err.operation).toBe('my-op');
      expect(err.timeoutMs).toBe(500);
      expect(err.traceId).toBe('trace-123');
      expect(err.message).toBe('Operation "my-op" timed out after 500ms');
    });
  });
});
