/**
 * Minimal, SW-safe structured logger with PII/token redaction.
 *
 * Kept free of any `self`/worker global and of any DOM dependency so it can
 * be imported and unit-tested under Node/Vitest. The service worker consumer
 * (`sw.ts`) only needs `swLogEvent` (plus `redactLog`/`REDACTED` for tests).
 */

export type SwLogLevel = 'info' | 'warning' | 'error';

/** Keys OR values matching this are scrubbed entirely. */
const REDACT_PATTERN = /token|key|secret|authorization|bearer/i;

/** Strings that look like a URL or absolute path (query-strip candidates). */
const URL_LIKE_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/|\/)/i;

export const REDACTED = '[REDACTED]';

/** W3C traceparent header used for page -> SW trace propagation. */
export const TRACEPARENT_HEADER = 'traceparent';
/** Project-specific trace id header (fallback propagation source). */
export const TRACE_ID_HEADER = 'x-trace-id';

/** Anything exposing a Headers-like `get(name)` (Request/Headers suffice). */
export interface TraceHeaderSource {
  get(name: string): string | null;
}

function redactString(key: string, value: string): string {
  let out = value;
  // Strip query strings and fragments from URL/path-like strings so tokens in
  // `?token=...` or `#access_token=...` never reach the log.
  if (URL_LIKE_RE.test(out)) {
    out = out.replace(/\?[^#]*/, '').replace(/#.*/, '');
  }
  if (REDACT_PATTERN.test(key) || REDACT_PATTERN.test(out)) {
    return REDACTED;
  }
  return out;
}

/**
 * Recursively redact a log payload. Values whose key OR value matches
 * `/token|key|secret|authorization|bearer/i` become `[REDACTED]`; URL-like
 * strings have their query strings and fragments stripped. Pure function, no
 * global access — directly unit-testable.
 */
export function redactLog(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string') {
      out[key] = redactString(key, value);
    } else if (Array.isArray(value)) {
      // `Array.isArray` narrows to `any[]`; re-narrow to `unknown[]` so map
      // callbacks aren't typed as `any`.
      out[key] = (value as unknown[]).map((item) =>
        typeof item === 'string' ? redactString(key, item) : item,
      );
    } else if (value !== null && typeof value === 'object') {
      out[key] = redactLog(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export interface SwLogOptions {
  /**
   * The initiating Request (or any Headers-like object) to read a
   * `traceparent`/`x-trace-id` from. When present the value is included on
   * the emitted line; otherwise the trace field is omitted entirely.
   */
  request?: { headers: TraceHeaderSource } | TraceHeaderSource;
  /** Injected console-like sink for tests; defaults to the global `console`. */
  sink?: Pick<Console, 'log' | 'warn' | 'error'>;
}

/**
 * Emit a single redacted JSON log line. Never throws — logging must not break
 * request/sync handling, and secrets must never reach the output.
 */
export function swLogEvent(
  level: SwLogLevel,
  event: string,
  extras: Record<string, unknown> = {},
  options: SwLogOptions = {},
): void {
  const sink = options.sink ?? console;
  const body: Record<string, unknown> = { level, event };

  // Trace propagation: pull a traceparent/x-trace-id from the initiating
  // request's headers when available; otherwise omit the field entirely.
  const source = options.request ?? undefined;
  const headers = source && 'headers' in source ? source.headers : source;
  if (headers && typeof headers.get === 'function') {
    const traceHeader =
      headers.get(TRACEPARENT_HEADER) ?? headers.get(TRACE_ID_HEADER) ?? undefined;
    if (traceHeader) body.traceHeader = traceHeader;
  }

  const line = JSON.stringify(redactLog({ ...body, ...extras }));

  if (level === 'error') sink.error(line);
  else if (level === 'warning') sink.warn(line);
  else sink.log(line);
}
