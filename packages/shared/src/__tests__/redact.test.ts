import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scrub, isSensitiveKey, scrubLogEntry } from '../redact';

const TRACE_ID = '550e8400-e29b-41d4-a716-446655440000';
const SPAN_ID = '44e83a0f';

describe('Log Redaction', () => {
  describe('isSensitiveKey', () => {
    it('detects password', () => {
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('PASSWORD')).toBe(true);
      expect(isSensitiveKey('Password')).toBe(true);
    });
    it('detects token variants', () => {
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('sessionToken')).toBe(true);
      expect(isSensitiveKey('session-token')).toBe(true);
    });
    it('detects api key', () => {
      expect(isSensitiveKey('apiKey')).toBe(true);
      expect(isSensitiveKey('api_key')).toBe(true);
      expect(isSensitiveKey('apikey')).toBe(true);
    });
    it('detects hyphenated header keys (A7: set-cookie normalization)', () => {
      expect(isSensitiveKey('Set-Cookie')).toBe(true);
      expect(isSensitiveKey('set-cookie')).toBe(true);
      expect(isSensitiveKey('setCookie')).toBe(true);
    });
    it('does not flag safe keys', () => {
      expect(isSensitiveKey('username')).toBe(false);
      expect(isSensitiveKey('email')).toBe(false);
      expect(isSensitiveKey('id')).toBe(false);
    });
  });

  describe('scrub', () => {
    it('redacts sensitive keys in flat objects', () => {
      const result = scrub({ username: 'jdoe', password: 'secret123' }) as Record<string, unknown>;
      expect(result.username).toBe('jdoe');
      expect(result.password).toBe('[REDACTED]');
    });

    it('redacts sensitive keys in nested objects', () => {
      const result = scrub({
        user: { id: '1', auth: { token: 'abc' } },
      }) as { user?: { id?: unknown; auth?: { token?: unknown } } };
      expect(result.user?.id).toBe('1');
      expect(result.user?.auth?.token).toBe('[REDACTED]');
    });

    it('redacts emails in string values', () => {
      const result = scrub({ message: 'Contact user@example.com for help' });
      expect((result as Record<string, string>).message).toBe('Contact [REDACTED] for help');
    });

    it('redacts Bearer tokens in string values', () => {
      const result = scrub({ header: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload' });
      expect((result as Record<string, string>).header).toBe('Authorization: Bearer [REDACTED]');
    });

    it('redacts long tokens in string values', () => {
      const longToken = 'a'.repeat(40);
      const result = scrub({ data: `prefix-${longToken}-suffix` });
      // The regex matches the entire alphanumeric+hyphen run as one token
      expect((result as Record<string, string>).data).toBe('[REDACTED]');
    });

    it('redacts hyphenated sensitive header names in objects', () => {
      const result = scrub({ 'Set-Cookie': 'do_session=SYNTHETIC' }) as Record<string, string>;
      expect(result['Set-Cookie']).toBe('[REDACTED]');
    });

    it('handles arrays', () => {
      const result = scrub([{ password: 'x' }, { username: 'y' }]) as Array<Record<string, string>>;
      expect(result[0]?.password).toBe('[REDACTED]');
      expect(result[1]?.username).toBe('y');
    });

    it('handles null and undefined', () => {
      expect(scrub(null)).toBe(null);
      expect(scrub(undefined)).toBe(undefined);
    });

    it('handles primitives', () => {
      expect(scrub(42)).toBe(42);
      expect(scrub(true)).toBe(true);
      expect(scrub('hello')).toBe('hello');
    });
  });

  describe('scrubLogEntry (A6 correlation contract)', () => {
    it('preserves validated trace/span ids at the record level', () => {
      const entry = scrubLogEntry({
        level: 'error',
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        event: 'request.error',
      });
      expect(entry.traceId).toBe(TRACE_ID);
      expect(entry.spanId).toBe(SPAN_ID);
      expect(entry.event).toBe('request.error');
    });

    it('preserves ingest/client correlation ids inside metadata', () => {
      const entry = scrubLogEntry({
        level: 'warn',
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        event: 'telemetry.received',
        metadata: {
          ingestTraceId: TRACE_ID,
          ingestSpanId: SPAN_ID,
          clientTraceId: 'd'.repeat(32),
          clientSpanId: SPAN_ID,
          details: 'e'.repeat(40),
        },
      });
      const metadata = entry.metadata as Record<string, unknown>;
      expect(metadata.ingestTraceId).toBe(TRACE_ID);
      expect(metadata.ingestSpanId).toBe(SPAN_ID);
      expect(metadata.clientTraceId).toBe('d'.repeat(32));
      expect(metadata.clientSpanId).toBe(SPAN_ID);
      expect(metadata.details).toBe('[REDACTED]');
    });

    it('still redacts identifier-shaped secrets under non-correlation keys', () => {
      const entry = scrubLogEntry({
        level: 'info',
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        event: 'test.event',
        metadata: {
          note: 'c'.repeat(40),
          apiKey: 'a'.repeat(40),
          contact: 'reader@example.test',
          header: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload',
        },
      });
      const serialized = JSON.stringify(entry);
      expect((entry.metadata as Record<string, unknown>).note).toBe('[REDACTED]');
      expect((entry.metadata as Record<string, unknown>).apiKey).toBe('[REDACTED]');
      expect((entry.metadata as Record<string, unknown>).contact).toBe('[REDACTED]');
      expect(serialized).not.toContain('c'.repeat(40));
      expect(serialized).not.toContain('reader@example.test');
      expect(serialized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('redacts an oversized correlation value instead of echoing it', () => {
      const oversized = 'a'.repeat(65);
      const entry = scrubLogEntry({ level: 'info', traceId: oversized, event: 'test.event' });
      expect(entry.traceId).toBe('[REDACTED]');
    });

    it('redacts sensitive keys at the record level (walker owns the key rule)', () => {
      const entry = scrubLogEntry({
        level: 'info',
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        event: 'test.event',
        password: 'hunter2',
        'Set-Cookie': 'do_session=SYNTHETIC',
      });
      expect(entry.password).toBe('[REDACTED]');
      expect(entry['Set-Cookie']).toBe('[REDACTED]');
    });

    it('does not preserve correlation-shaped values in nested non-metadata objects', () => {
      const entry = scrubLogEntry({
        level: 'info',
        traceId: TRACE_ID,
        spanId: SPAN_ID,
        event: 'test.event',
        error: { name: 'Error', message: 'boom', traceId: TRACE_ID },
      });
      expect((entry.error as Record<string, unknown>).traceId).toBe('[REDACTED]');
    });
  });

  // ADR-034 layer 1 + 3 for the redaction patterns: the email scan was
  // quadratic on a value full of '%'/'.' with no '@' (CodeQL
  // js/polynomial-redos #14), and a real address must still be redacted at any
  // offset inside such padding.
  //
  // Linearity is asserted by *scaling*, not by a fixed wall-clock budget: the
  // same scan costs ~2 ms locally and ~40 ms on a GitHub runner, so an absolute
  // bound tight enough to catch a quadratic pattern locally goes red in CI. An
  // 8x input must cost about 8x the time (quadratic would cost ~64x), which is
  // machine-independent; the absolute ceiling only guards against a hang.
  describe('ReDoS hardening (ADR-034)', () => {
    const bestOf = (value: string): number => {
      const samples: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const started = performance.now();
        scrub({ message: value });
        samples.push(performance.now() - started);
      }
      return Math.min(...samples);
    };

    const ADVERSARIAL: Array<[string, string]> = [
      ['percent run', '%'.repeat(8_000)],
      ['dot run', '.'.repeat(8_000)],
      ['at + percent run', 'a@' + '%'.repeat(8_000)],
      ['at + dot run', 'a@' + '.'.repeat(8_000)],
      ['local part then dots', 'user@' + 'a.'.repeat(4_000)],
      ['single long token', 'a'.repeat(8_000)],
      ['at signs', '@'.repeat(8_000)],
      ['email-ish alternation', 'a.@.a'.repeat(2_000)],
    ];

    it.each(ADVERSARIAL)('scrubs %s without hanging', (_label, value) => {
      // Warm the JIT so the ceiling measures the scan, not first-call overhead.
      bestOf(value);
      expect(bestOf(value)).toBeLessThan(500);
    });

    it('scales linearly when adversarial padding grows 8x', () => {
      const small = '%'.repeat(4_000);
      const large = '%'.repeat(32_000);
      bestOf(small);
      const smallMs = Math.max(bestOf(small), 0.05);
      const largeMs = bestOf(large);
      // Linear ⇒ ~8x. The quadratic predecessor measured 13.5 ms → ~860 ms
      // (64x), so a ratio ceiling of 12 separates the two by a wide margin.
      expect(largeMs / smallMs).toBeLessThan(12);
    });

    it('still redacts an address buried in adversarial padding', () => {
      const value = '%'.repeat(5_000) + ' user@example.com ' + '.'.repeat(5_000);
      const result = scrub({ message: value }) as Record<string, string>;
      expect(result.message).not.toContain('user@example.com');
      expect(result.message).toContain('[REDACTED]');
    });

    it('redacts every generated email-shaped value', () => {
      const local = fc.stringMatching(/^[a-zA-Z0-9._%+-]{1,64}$/);
      const label = fc.stringMatching(/^[a-zA-Z0-9-]{1,63}$/);
      const tld = fc.stringMatching(/^[a-zA-Z]{2,63}$/);
      fc.assert(
        fc.property(local, label, tld, (l, d, t) => {
          const result = scrub({ message: `${l}@${d}.${t}` }) as Record<string, string>;
          expect(result.message).not.toContain('@');
        }),
        { numRuns: 200 },
      );
    });
  });
});
