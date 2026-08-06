import { describe, it, expect } from 'vitest';
import {
  SearchQuerySchema,
  ExportQuerySchema,
  NotificationsQuerySchema,
} from '../schemas';

describe('SearchQuerySchema', () => {
  it('accepts valid query', () => {
    const result = SearchQuerySchema.parse({ q: 'test search' });
    expect(result.q).toBe('test search');
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('accepts query with custom limit and offset', () => {
    const result = SearchQuerySchema.parse({ q: 'query', limit: '10', offset: '5' });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  it('rejects empty query', () => {
    expect(() => SearchQuerySchema.parse({ q: '' })).toThrow();
  });

  it('rejects missing q field', () => {
    expect(() => SearchQuerySchema.parse({})).toThrow();
  });

  it('accepts q at exactly 500 chars (boundary)', () => {
    const result = SearchQuerySchema.parse({ q: 'a'.repeat(500) });
    expect(result.q).toHaveLength(500);
  });

  it('rejects q longer than 500 chars', () => {
    expect(() => SearchQuerySchema.parse({ q: 'a'.repeat(501) })).toThrow();
  });

  it('rejects limit > 50', () => {
    expect(() => SearchQuerySchema.parse({ q: 'query', limit: 51 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => SearchQuerySchema.parse({ q: 'query', offset: -1 })).toThrow();
  });
});

describe('ExportQuerySchema', () => {
  it('accepts valid query with default format', () => {
    const result = ExportQuerySchema.parse({});
    expect(result.format).toBe('markdown');
  });

  it('accepts html format', () => {
    const result = ExportQuerySchema.parse({ format: 'html' });
    expect(result.format).toBe('html');
  });

  it('rejects invalid format', () => {
    expect(() => ExportQuerySchema.parse({ format: 'pdf' })).toThrow();
  });

  it('rejects uppercase format (HTML)', () => {
    expect(() => ExportQuerySchema.parse({ format: 'HTML' })).toThrow();
  });
});

describe('NotificationsQuerySchema', () => {
  it('accepts valid query with defaults', () => {
    const result = NotificationsQuerySchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
    expect(result.unread).toBe('false');
  });

  it('accepts query with custom values', () => {
    const result = NotificationsQuerySchema.parse({ limit: '50', offset: '10', unread: 'true' });
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(10);
    expect(result.unread).toBe('true');
  });

  it('rejects limit > 100', () => {
    expect(() => NotificationsQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects limit=0', () => {
    expect(() => NotificationsQuerySchema.parse({ limit: 0 })).toThrow();
  });

  it('accepts explicit offset=0', () => {
    const result = NotificationsQuerySchema.parse({ offset: '0' });
    expect(result.offset).toBe(0);
  });

  it('rejects negative offset', () => {
    expect(() => NotificationsQuerySchema.parse({ offset: -1 })).toThrow();
  });

  it('rejects invalid unread value', () => {
    expect(() => NotificationsQuerySchema.parse({ unread: 'yes' })).toThrow();
  });
});
