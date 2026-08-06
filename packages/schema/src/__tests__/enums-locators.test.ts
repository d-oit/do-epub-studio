import { describe, it, expect } from 'vitest';
import {
  BookVisibilitySchema,
  GrantModeSchema,
  CommentStatusSchema,
  CommentVisibilitySchema,
  EntityTypeSchema,
  ProgressLocatorSchema,
  MultiSignalLocatorSchema,
} from '../schemas';

describe('Enum Schemas', () => {
  describe('BookVisibilitySchema', () => {
    it('accepts valid values', () => {
      expect(BookVisibilitySchema.parse('private')).toBe('private');
      expect(BookVisibilitySchema.parse('public')).toBe('public');
      expect(BookVisibilitySchema.parse('password_protected')).toBe('password_protected');
      expect(BookVisibilitySchema.parse('reader_only')).toBe('reader_only');
      expect(BookVisibilitySchema.parse('editorial_review')).toBe('editorial_review');
    });

    it('rejects invalid values', () => {
      expect(() => BookVisibilitySchema.parse('invalid')).toThrow();
    });
  });

  describe('GrantModeSchema', () => {
    it('accepts valid values', () => {
      expect(GrantModeSchema.parse('private')).toBe('private');
      expect(GrantModeSchema.parse('public')).toBe('public');
    });
  });

  describe('CommentStatusSchema', () => {
    it('accepts valid values', () => {
      expect(CommentStatusSchema.parse('open')).toBe('open');
      expect(CommentStatusSchema.parse('resolved')).toBe('resolved');
      expect(CommentStatusSchema.parse('deleted')).toBe('deleted');
    });
  });

  describe('CommentVisibilitySchema', () => {
    it('accepts valid values', () => {
      expect(CommentVisibilitySchema.parse('shared')).toBe('shared');
      expect(CommentVisibilitySchema.parse('internal')).toBe('internal');
      expect(CommentVisibilitySchema.parse('resolved')).toBe('resolved');
    });
  });

  describe('EntityTypeSchema', () => {
    it('accepts valid values', () => {
      expect(EntityTypeSchema.parse('book')).toBe('book');
      expect(EntityTypeSchema.parse('grant')).toBe('grant');
      expect(EntityTypeSchema.parse('session')).toBe('session');
      expect(EntityTypeSchema.parse('comment')).toBe('comment');
      expect(EntityTypeSchema.parse('user')).toBe('user');
      expect(EntityTypeSchema.parse('bookmark')).toBe('bookmark');
      expect(EntityTypeSchema.parse('highlight')).toBe('highlight');
    });
  });
});

describe('ProgressLocatorSchema', () => {
  it('accepts locator with cfi only', () => {
    const result = ProgressLocatorSchema.parse({ cfi: 'epubcfi(/6/4)' });
    expect(result.cfi).toBe('epubcfi(/6/4)');
  });

  it('accepts locator with cfi and optional fields', () => {
    const result = ProgressLocatorSchema.parse({ cfi: 'cfi', selectedText: 'text', chapterRef: 'ch1' });
    expect(result.cfi).toBe('cfi');
    expect(result.selectedText).toBe('text');
    expect(result.chapterRef).toBe('ch1');
  });

  it('rejects locator without cfi', () => {
    expect(() => ProgressLocatorSchema.parse({ selectedText: 'text' })).toThrow();
  });

  it('enforces max length for cfi', () => {
    expect(() => ProgressLocatorSchema.parse({ cfi: 'x'.repeat(2049) })).toThrow();
  });
});

describe('MultiSignalLocatorSchema', () => {
  it('accepts valid multi-signal locator', () => {
    const result = MultiSignalLocatorSchema.parse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'hello',
      chapterRef: 'ch1',
    });
    expect(result.cfi).toBe('epubcfi(/6/4)');
    expect(result.selectedText).toBe('hello');
    expect(result.chapterRef).toBe('ch1');
  });

  it('rejects missing cfi', () => {
    expect(() => MultiSignalLocatorSchema.parse({ selectedText: 'text', chapterRef: 'ch1' })).toThrow();
  });

  it('rejects missing selectedText', () => {
    expect(() => MultiSignalLocatorSchema.parse({ cfi: 'cfi', chapterRef: 'ch1' })).toThrow();
  });

  it('rejects missing chapterRef', () => {
    expect(() => MultiSignalLocatorSchema.parse({ cfi: 'cfi', selectedText: 'text' })).toThrow();
  });

  it('rejects empty cfi', () => {
    expect(() => MultiSignalLocatorSchema.parse({ cfi: '', selectedText: 'text', chapterRef: 'ch' })).toThrow();
  });

  it('rejects extra fields (strict mode)', () => {
    expect(() => MultiSignalLocatorSchema.parse({ cfi: 'cfi', selectedText: 'text', chapterRef: 'ch', extra: true })).toThrow();
  });
});
