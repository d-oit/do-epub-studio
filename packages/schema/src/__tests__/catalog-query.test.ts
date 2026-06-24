import { describe, it, expect } from 'vitest';
import { CatalogQuerySchema } from '../schemas';

describe('CatalogQuerySchema', () => {
  it('accepts empty query and applies defaults', () => {
    const result = CatalogQuerySchema.parse({});
    expect(result.limit).toBe(24);
    expect(result.offset).toBe(0);
  });

  it('coerces string limit/offset from query params', () => {
    const result = CatalogQuerySchema.parse({ limit: '10', offset: '30' });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(30);
  });

  it('accepts optional filters', () => {
    const result = CatalogQuerySchema.parse({ q: 'orwell', author: 'George Orwell', language: 'en' });
    expect(result.q).toBe('orwell');
    expect(result.author).toBe('George Orwell');
    expect(result.language).toBe('en');
  });

  it('rejects limit above max', () => {
    expect(() => CatalogQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => CatalogQuerySchema.parse({ offset: -1 })).toThrow();
  });

  it('rejects too-long q', () => {
    expect(() => CatalogQuerySchema.parse({ q: 'a'.repeat(256) })).toThrow();
  });
});
