/**
 * Client-side telemetry utilities.
 *
 * `createTraceId`, `createSpanId`, and `serializeError` are canonical
 * implementations that live in @do-epub-studio/shared. They are re-exported
 * here so that all web-app code has a single import path, and so the local
 * duplicate implementations (removed in this commit) don't drift from the
 * shared ones.
 */
export { createTraceId, createSpanId, serializeError } from '@do-epub-studio/shared';
export type { SerializedError } from '@do-epub-studio/shared';

export interface ClientLogEntry {
  level: 'info' | 'warn' | 'error';
  traceId: string;
  spanId?: string;
  event: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export function logClientEvent(entry: ClientLogEntry): void {
  const payload = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(payload);
    return;
  }
  if (entry.level === 'warn') {
    console.warn(payload);
    return;
  }
  console.log(payload);
}
