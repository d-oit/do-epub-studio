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

export function createTraceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${randomSegment(12)}`;
}

export function createSpanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().split('-')[0] ?? randomSegment(8);
  }
  return randomSegment(10);
}

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
