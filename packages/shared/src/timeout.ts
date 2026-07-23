import { TimeoutError } from './errors';

export interface TimeoutOptions {
  /** Maximum milliseconds before the operation is aborted */
  timeoutMs: number;
  /** Human-readable operation name for error messages */
  operation: string;
  /** Optional trace identifier for distributed tracing */
  traceId?: string;
  /** Optional external AbortSignal to link against */
  signal?: AbortSignal;
}

/**
 * Wrap an async operation with a timeout.
 *
 * Creates an internal AbortController and optionally links it to an external
 * signal. The `fn` callback receives the internal signal so sub-operations
 * can check `signal.aborted` for early bail-out.
 *
 * @param fn - The operation to execute, receiving an AbortSignal
 * @param options - Timeout configuration
 * @returns The result of `fn`
 * @throws {TimeoutError} if the operation exceeds `timeoutMs`
 * @throws {DOMException} if the external signal is aborted
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T> | T,
  options: TimeoutOptions,
): Promise<T> {
  const { timeoutMs, operation, traceId, signal: externalSignal } = options;

  const controller = new AbortController();
  const { signal } = controller;

  let timer: ReturnType<typeof setTimeout> | undefined;

  function cleanup(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  function onExternalAbort(): void {
    cleanup();
    controller.abort();
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort);
  }

  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      cleanup();
      controller.abort();
      reject(new TimeoutError(operation, timeoutMs, traceId));
    }, timeoutMs);

    try {
      const result = fn(signal);
      if (result instanceof Promise) {
        result
          .then((value) => {
            cleanup();
            resolve(value);
          })
          .catch((err: unknown) => {
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      } else {
        cleanup();
        resolve(result);
      }
    } catch (err: unknown) {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/**
 * Throw a {@link TimeoutError} if the current time exceeds `deadline`.
 *
 * Use this synchronous check inside loops or between processing passes
 * where an async `withTimeout` wrapper is impractical (e.g., epubjs
 * content hooks that must remain synchronous).
 *
 * @param deadline - Absolute timestamp from `performance.now() + timeoutMs`
 * @param operation - Operation name for the error message
 * @param timeoutMs - Original timeout budget for the error message
 * @param traceId - Optional trace identifier
 * @throws {TimeoutError} if `performance.now() > deadline`
 */
export function checkDeadline(
  deadline: number,
  operation: string,
  timeoutMs: number,
  traceId?: string,
): void {
  if (performance.now() > deadline) {
    throw new TimeoutError(operation, timeoutMs, traceId);
  }
}

/**
 * Create an absolute deadline timestamp for use with {@link checkDeadline}.
 *
 * @param timeoutMs - Milliseconds from now
 * @returns An absolute `performance.now()` timestamp
 */
export function createDeadline(timeoutMs: number): number {
  return performance.now() + timeoutMs;
}
