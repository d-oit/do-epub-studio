/**
 * Serialized representation of an error suitable for JSON transport
 * across the API boundary (Worker ↔ client).
 */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError | string;
  status?: number;
}

const RANDOM_SOURCE = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomSegment(length: number): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto && length === 12) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  let result = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * RANDOM_SOURCE.length);
    result += RANDOM_SOURCE[index];
  }
  return result;
}

/**
 * Generate a unique trace identifier for distributed request tracing.
 *
 * Uses `crypto.randomUUID()` when available, falling back to a
 * timestamp + random string for older environments.
 *
 * @returns A unique trace ID string
 *
 * @example
 * ```ts
 * const traceId = createTraceId();
 * // → "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function createTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${randomSegment(12)}`;
}

/**
 * Generate a short span identifier for correlating sub-operations
 * within a trace.
 *
 * @returns A unique span ID string (shorter than traceId)
 */
export function createSpanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().split('-')[0] ?? randomSegment(8);
  }
  return randomSegment(10);
}

/**
 * Convert an unknown error value into a serializable plain object
 * suitable for logging or API transport.
 *
 * Handles `Error` instances (including nested `.cause`), string
 * causes, and non-Error throw values.
 *
 * @param error - The caught error value
 * @returns A `SerializedError` plain object
 */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause:
        error.cause instanceof Error
          ? serializeError(error.cause)
          : typeof error.cause === 'string'
            ? error.cause
            : undefined,
    };
  }

  if (typeof error === 'string') {
    return { name: 'Error', message: error };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      name: (error as { name?: string }).name ?? 'Error',
      message: JSON.stringify(error),
    };
  }

  return { name: 'Error', message: String(error) };
}

export const TRACE_HEADER = 'x-trace-id';
export const SPAN_HEADER = 'x-span-id';
export const LOCALE_HEADER = 'accept-language';
