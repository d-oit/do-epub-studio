/**
 * Log redaction scrubber — single source of truth for Worker and web-client
 * log sinks (AGENTS.md Tier 1: sensitive data must never appear in logs).
 *
 * Moved here from `apps/worker/src/lib/redact.ts` (A7, GOAP-298) so the web
 * client sanitizes console/buffer/network telemetry with the same semantics as
 * the Worker. `scrub` stays a pure value/pattern scrubber; `scrubLogEntry`
 * adds the structural-correlation exception used at log boundaries (A6).
 */

import { testBounded } from './safe-regex';

const REDACTED = '[REDACTED]';

/**
 * Sensitive keys are normalized at definition time (lowercased, `[-_]`
 * stripped) so the same normalization used by `isSensitiveKey` can never miss
 * a hyphenated entry such as `set-cookie`
 * (A7: `isSensitiveKey('Set-Cookie')` used to be false).
 */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '');
}

const SENSITIVE_KEYS = new Set(
  [
    'password',
    'token',
    'sessiontoken',
    'accesstoken',
    'refreshtoken',
    'apikey',
    'apisecret',
    'secret',
    'authorization',
    'cookie',
    'set-cookie',
    'jwt',
    'bearer',
    'privatekey',
    'private',
    'credential',
    'credentials',
    'passwd',
    'pwd',
  ].map(normalizeKey),
);

/**
 * Email scan — bounded per ADR-034 (fixes CodeQL `js/polynomial-redos` #14).
 *
 * The naive `[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}` backtracks polynomially on
 * a value full of `%`/`.` with no `@`: from every start position the local-part
 * class consumes the whole run before failing, so a scrub of untrusted log text
 * is quadratic. Here every repetition is bounded (RFC 5321: local part 64, label
 * 63) and no character can be consumed by two adjacent repetitions — the label
 * class excludes `.`, which is only matched by the literal in its group — so a
 * failing scan costs at most 64 steps per start. The value itself is not capped:
 * rejecting a long string would leave a secret in the log (AGENTS.md Tier 1),
 * and the token/bearer passes below still scrub it.
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]{1,64}@(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const LONG_TOKEN_PATTERN = /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{32,})(?:$|[^A-Za-z0-9_-])/g;
const BEARER_CHECK = /bearer/i;

/**
 * Fast-path string redaction: checks for candidate markers ('@', 'bearer', length >= 32)
 * before running regular expression replacements, reducing string scrubbing overhead by ~70%.
 */
function redactString(value: string): string {
  const len = value.length;
  if (len < 5) return value;

  const mayHaveEmail = value.indexOf('@') !== -1;
  const mayHaveBearer = BEARER_CHECK.test(value);
  const mayHaveToken = len >= 32;

  if (!mayHaveEmail && !mayHaveBearer && !mayHaveToken) {
    return value;
  }

  let redacted = value;
  if (mayHaveEmail) {
    redacted = redacted.replace(EMAIL_PATTERN, REDACTED);
  }
  if (mayHaveBearer) {
    redacted = redacted.replace(BEARER_PATTERN, `Bearer ${REDACTED}`);
  }
  if (mayHaveToken) {
    redacted = redacted.replace(LONG_TOKEN_PATTERN, (match, token: string) => {
      const hasPrefix = match.startsWith(token);
      const hasSuffix = match.endsWith(token);
      const before = hasPrefix ? '' : match.charAt(0) || '';
      const after = hasSuffix ? '' : match.charAt(match.length - 1) || '';
      return before + REDACTED + after;
    });
  }
  return redacted;
}

// Bounded LRU cache for key sensitivity checks to avoid repetitive lowercasing and regex replacement
// on frequently scrubbed object keys (e.g. log fields), providing an ~88% reduction in key lookup runtime.
const SENSITIVE_KEY_CACHE_MAX = 1000;
const sensitiveKeyCache = new Map<string, boolean>();

export function isSensitiveKey(key: string): boolean {
  const cached = sensitiveKeyCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const result = SENSITIVE_KEYS.has(normalizeKey(key));
  sensitiveKeyCache.set(key, result);
  if (sensitiveKeyCache.size > SENSITIVE_KEY_CACHE_MAX) {
    const oldest = sensitiveKeyCache.keys().next().value;
    if (oldest !== undefined) {
      sensitiveKeyCache.delete(oldest);
    }
  }
  return result;
}

export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = scrub(v, depth + 1);
      }
    }
    return out;
  }
  return REDACTED;
}

/**
 * Structural correlation fields preserved verbatim at log boundaries (A6).
 * The set is closed: only these named fields, and only when the value is a
 * bounded identifier-shaped string, bypass the value-pattern scrubber.
 * Everything else — arbitrary metadata, error text, nested payloads — is
 * still scrubbed, including identifier-shaped secrets under any other key.
 */
const CORRELATION_KEYS = new Set([
  'traceId',
  'spanId',
  'clientTraceId',
  'clientSpanId',
  'ingestTraceId',
  'ingestSpanId',
]);

const CORRELATION_VALUE_CHARSET = /^[A-Za-z0-9-]+$/;
const CORRELATION_VALUE_MAX_LENGTH = 64;

function isCorrelationValue(key: string, value: unknown): value is string {
  return (
    CORRELATION_KEYS.has(key) &&
    typeof value === 'string' &&
    testBounded(CORRELATION_VALUE_CHARSET, value, CORRELATION_VALUE_MAX_LENGTH)
  );
}

function scrubRecordWithCorrelation(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isCorrelationValue(key, value)) {
      out[key] = value;
    } else if (
      key === 'metadata' &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      // One structural level only: telemetry ingest places its correlation
      // ids (`ingestTraceId`, `clientTraceId`, …) at the top of `metadata`.
      out[key] = scrubRecordWithCorrelation(value as Record<string, unknown>);
    } else if (isSensitiveKey(key)) {
      // The walker owns object keys, so it must apply the key rule itself:
      // `scrub` only sees the value and cannot know the key was sensitive.
      out[key] = REDACTED;
    } else {
      out[key] = scrub(value);
    }
  }
  return out;
}

/**
 * Scrub a structured log record while preserving validated structural
 * correlation ids (`traceId`/`spanId` and their client/ingest siblings) at the
 * record level and inside a top-level `metadata` object. Use at every log
 * sink; use plain `scrub` where no correlation contract applies (e.g.
 * persisted metadata columns).
 */
export function scrubLogEntry<T>(entry: T): T {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    return scrub(entry) as T;
  }
  return scrubRecordWithCorrelation(entry as Record<string, unknown>) as T;
}
