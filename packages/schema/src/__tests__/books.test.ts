import { describe, it, expect } from 'vitest';
import {
  CreateBookSchema,
  UpdateBookSchema,
} from '../schemas';

describe('CreateBookSchema', () => {
  it('accepts valid book', () => {
    const result = CreateBookSchema.parse({ title: 'My Book', slug: 'my-book' });
    expect(result.title).toBe('My Book');
    expect(result.slug).toBe('my-book');
    expect(result.language).toBe('en');
    expect(result.visibility).toBe('private');
  });

  it('rejects invalid slug format', () => {
    expect(() => CreateBookSchema.parse({ title: 'Book', slug: 'Invalid Slug!' })).toThrow();
  });

  it('accepts slug with hyphens and underscores', () => {
    const result = CreateBookSchema.parse({ title: 'Book', slug: 'my_book-2' });
    expect(result.slug).toBe('my_book-2');
  });

  it('rejects empty title', () => {
    expect(() => CreateBookSchema.parse({ title: '', slug: 'slug' })).toThrow();
  });

  it('rejects slug longer than 255 chars', () => {
    expect(() => CreateBookSchema.parse({ title: 'Book', slug: 'a'.repeat(256) })).toThrow();
  });
});

describe('UpdateBookSchema', () => {
  it('accepts partial update', () => {
    const result = UpdateBookSchema.parse({ title: 'Updated Title' });
    expect(result.title).toBe('Updated Title');
  });

  it('accepts empty update', () => {
    const result = UpdateBookSchema.parse({});
    expect(result).toEqual({});
  });
});