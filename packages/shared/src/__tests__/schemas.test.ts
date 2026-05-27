import { describe, expect, it } from 'vitest';
import {
  AnnotationLocatorSchema,
  AccessRequestSchema,
  CreateBookSchema,
  CreateGrantSchema,
} from '../schemas';

describe('AnnotationLocatorSchema', () => {
  it('accepts a valid cfi', () => {
    const result = AnnotationLocatorSchema.safeParse({ cfi: 'epubcfi(/6/4)' });
    expect(result.success).toBe(true);
  });

  it('accepts valid selectedText without cfi', () => {
    const result = AnnotationLocatorSchema.safeParse({ selectedText: 'hello world' });
    expect(result.success).toBe(true);
  });

  it('accepts both cfi and selectedText', () => {
    const result = AnnotationLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'excerpt',
      chapterRef: 'chapter-1',
      elementIndex: 0,
      charOffset: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty object with no cfi or selectedText', () => {
    const result = AnnotationLocatorSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('cfi or selectedText');
    }
  });

  it('rejects object with only chapterRef', () => {
    const result = AnnotationLocatorSchema.safeParse({ chapterRef: 'ch1' });
    expect(result.success).toBe(false);
  });
});

describe('AccessRequestSchema', () => {
  it('accepts valid input', () => {
    const result = AccessRequestSchema.safeParse({
      bookSlug: 'my-book',
      email: 'reader@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional password', () => {
    const result = AccessRequestSchema.safeParse({
      bookSlug: 'my-book',
      email: 'reader@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty bookSlug', () => {
    const result = AccessRequestSchema.safeParse({ bookSlug: '', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = AccessRequestSchema.safeParse({ bookSlug: 'book', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects bookSlug longer than 255 chars', () => {
    const result = AccessRequestSchema.safeParse({
      bookSlug: 'a'.repeat(256),
      email: 'a@b.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateBookSchema', () => {
  it('accepts minimal valid input', () => {
    const result = CreateBookSchema.safeParse({ title: 'My Book', slug: 'my-book' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('en');
      expect(result.data.visibility).toBe('private');
    }
  });

  it('applies default values', () => {
    const result = CreateBookSchema.safeParse({ title: 'Book', slug: 'b' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('en');
      expect(result.data.visibility).toBe('private');
    }
  });

  it('accepts slug with underscores', () => {
    const result = CreateBookSchema.safeParse({ title: 'Book', slug: 'my_book' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid slug with uppercase', () => {
    const result = CreateBookSchema.safeParse({ title: 'Book', slug: 'My-Book' });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = CreateBookSchema.safeParse({ title: '', slug: 'book' });
    expect(result.success).toBe(false);
  });

  it('rejects language not exactly 2 chars', () => {
    const result = CreateBookSchema.safeParse({ title: 'Book', slug: 'book', language: 'eng' });
    expect(result.success).toBe(false);
  });
});

describe('CreateGrantSchema', () => {
  it('accepts valid grant', () => {
    const result = CreateGrantSchema.safeParse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      password: 'strongpass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid bookId', () => {
    const result = CreateGrantSchema.safeParse({
      bookId: 'not-a-uuid',
      email: 'user@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 chars', () => {
    const result = CreateGrantSchema.safeParse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('defaults mode to private', () => {
    const result = CreateGrantSchema.safeParse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mode).toBe('private');
      expect(result.data.commentsAllowed).toBe(false);
      expect(result.data.offlineAllowed).toBe(false);
    }
  });
});

