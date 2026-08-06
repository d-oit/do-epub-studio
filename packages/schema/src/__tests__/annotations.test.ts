import { describe, it, expect } from 'vitest';
import {
  ProgressUpdateSchema,
  BookmarkCreateSchema,
  HighlightCreateSchema,
  HighlightUpdateSchema,
  CommentCreateSchema,
  CommentUpdateSchema,
} from '../schemas';

describe('ProgressUpdateSchema', () => {
  it('accepts valid progress', () => {
    const result = ProgressUpdateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      progressPercent: 50,
    });
    expect(result.progressPercent).toBe(50);
  });

  it('rejects progressPercent > 100', () => {
    expect(() => ProgressUpdateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      progressPercent: 101,
    })).toThrow();
  });

  it('rejects negative progressPercent', () => {
    expect(() => ProgressUpdateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      progressPercent: -1,
    })).toThrow();
  });
});

describe('BookmarkCreateSchema', () => {
  it('accepts valid bookmark', () => {
    const result = BookmarkCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
    });
    expect(result.locator).toBeDefined();
  });

  it('accepts bookmark with label', () => {
    const result = BookmarkCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      label: 'My bookmark',
    });
    expect(result.label).toBe('My bookmark');
  });
});

describe('HighlightCreateSchema', () => {
  it('accepts valid highlight', () => {
    const result = HighlightCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
    });
    expect(result.color).toBe('#ffff00');
  });

  it('accepts highlight with custom color', () => {
    const result = HighlightCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      color: '#ff0000',
    });
    expect(result.color).toBe('#ff0000');
  });

  it('rejects invalid color format', () => {
    expect(() => HighlightCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      color: 'red',
    })).toThrow();
  });

  it('rejects color without # prefix', () => {
    expect(() => HighlightCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      color: 'ff0000',
    })).toThrow();
  });
});

describe('CommentCreateSchema', () => {
  it('accepts valid comment', () => {
    const result = CommentCreateSchema.parse({ body: 'Great point!' });
    expect(result.body).toBe('Great point!');
    expect(result.visibility).toBe('shared');
  });

  it('accepts comment with locator', () => {
    const result = CommentCreateSchema.parse({
      locator: { cfi: 'cfi', selectedText: 'text', chapterRef: 'ch' },
      body: 'About this text...',
    });
    expect(result.locator).toBeDefined();
  });

  it('accepts comment with parentCommentId', () => {
    const result = CommentCreateSchema.parse({
      body: 'Reply',
      parentCommentId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.parentCommentId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects empty body', () => {
    expect(() => CommentCreateSchema.parse({ body: '' })).toThrow();
  });

  it('rejects body longer than 10000 chars', () => {
    expect(() => CommentCreateSchema.parse({ body: 'x'.repeat(10001) })).toThrow();
  });
});

describe('CommentUpdateSchema', () => {
  it('accepts partial update', () => {
    const result = CommentUpdateSchema.parse({ body: 'Updated' });
    expect(result.body).toBe('Updated');
  });

  it('accepts status update', () => {
    const result = CommentUpdateSchema.parse({ status: 'resolved' });
    expect(result.status).toBe('resolved');
  });
});

describe('HighlightUpdateSchema', () => {
  it('accepts partial update with note only', () => {
    const result = HighlightUpdateSchema.parse({ note: 'Updated note' });
    expect(result.note).toBe('Updated note');
  });

  it('accepts partial update with color only', () => {
    const result = HighlightUpdateSchema.parse({ color: '#ff0000' });
    expect(result.color).toBe('#ff0000');
  });

  it('accepts empty update (color gets default from parent)', () => {
    const result = HighlightUpdateSchema.parse({});
    expect(result.color).toBe('#ffff00');
  });

  it('rejects invalid color format', () => {
    expect(() => HighlightUpdateSchema.parse({ color: 'red' })).toThrow();
  });
});
