import { describe, it, expect } from 'vitest';
import { LibraryQuerySchema } from '../schemas';

describe('LibraryQuerySchema', () => {
  it('accepts empty query and applies defaults', () => {
    const result = LibraryQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('coerces string limit/offset from query params', () => {
    const result = LibraryQuerySchema.parse({ limit: '20', offset: '30' });
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(30);
  });

  it('rejects limit above max', () => {
    expect(() => LibraryQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => LibraryQuerySchema.parse({ offset: -1 })).toThrow();
  });

  it('rejects zero limit', () => {
    expect(() => LibraryQuerySchema.parse({ limit: 0 })).toThrow();
  });
});
