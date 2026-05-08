import { describe, it, expect } from 'vitest';
import { sanitizeAuditPayload } from '../audit';

describe('sanitizeAuditPayload', () => {
  it('truncates long strings over 10000 chars', () => {
    const longStr = 'a'.repeat(15000);
    const result = sanitizeAuditPayload({ text: longStr });
    expect(result.text).toBe('a'.repeat(10000) + '...');
  });

  it('preserves short strings', () => {
    const result = sanitizeAuditPayload({ text: 'hello' });
    expect(result.text).toBe('hello');
  });

  it('preserves numbers and booleans', () => {
    const result = sanitizeAuditPayload({ count: 42, active: true });
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it('truncates deeply nested objects at MAX_SANITIZE_DEPTH', () => {
    let nested: Record<string, unknown> = { key: 'value' };
    for (let i = 0; i < 15; i++) {
      nested = { nested };
    }
    const result = sanitizeAuditPayload(nested);
    let depth = 0;
    let current = result;
    while (current.nested && typeof current.nested === 'object' && !('truncated' in current.nested)) {
      current = current.nested as Record<string, unknown>;
      depth++;
    }
    expect(depth).toBeLessThanOrEqual(10);
  });

  it('returns sanitized truncated marker at max depth', () => {
    let deep: Record<string, unknown> = { key: 'value' };
    for (let i = 0; i < 12; i++) {
      deep = { nested: deep };
    }
    const result = sanitizeAuditPayload(deep);
    let current = result;
    let depth = 0;
    let foundTruncated = false;
    while (current && typeof current === 'object') {
      if ('truncated' in current && current.truncated === true) {
        foundTruncated = true;
        break;
      }
      if (!current.nested || typeof current.nested !== 'object') break;
      current = current.nested as Record<string, unknown>;
      depth++;
    }
    expect(foundTruncated).toBe(true);
    expect(depth).toBeGreaterThan(0);
  });

  it('truncates large arrays to 100 items', () => {
    const largeArray = Array.from({ length: 500 }, (_, i) => `item-${i}`);
    const result = sanitizeAuditPayload({ items: largeArray });
    expect((result.items as unknown[]).length).toBe(100);
  });

  it('handles null and undefined values', () => {
    const result = sanitizeAuditPayload({ a: null, b: undefined });
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
  });

  it('handles empty object', () => {
    const result = sanitizeAuditPayload({});
    expect(result).toEqual({});
  });

  it('sanitizes nested arrays of objects', () => {
    const payload = {
      comments: Array.from({ length: 200 }, (_, i) => ({
        id: i,
        text: 'comment ' + i,
        nested: { inner: 'deep' },
      })),
    };
    const result = sanitizeAuditPayload(payload);
    expect((result.comments as unknown[]).length).toBe(100);
    const first = (result.comments as Record<string, unknown>[])[0];
    expect(first.nested).toEqual({ inner: 'deep' });
  });
});
