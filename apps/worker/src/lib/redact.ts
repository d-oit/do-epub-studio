/**
 * Log redaction scrubber
 * AGENTS.md TIER-1: sensitive data must never appear in logs.
 * Plan 110 V5: central log-redaction layer for the Worker.
 */

const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
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
]);

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const LONG_TOKEN_PATTERN = /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{32,})(?:$|[^A-Za-z0-9_-])/g;

function redactString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(LONG_TOKEN_PATTERN, (_match, token) => {
      const before = _match.startsWith(token) ? '' : _match[0]!;
      const after = _match.endsWith(token) ? '' : _match[_match.length - 1]!;
      return `${before}${REDACTED}${after}`;
    });
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[-_]/g, ''));
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
  return value;
}

export function scrubForLog(payload: unknown): string {
  const scrubbed = scrub(payload);
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(scrubbed, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val as object)) return '[Circular]';
        seen.add(val as object);
      }
      return val;
    });
  } catch {
    return REDACTED;
  }
}
