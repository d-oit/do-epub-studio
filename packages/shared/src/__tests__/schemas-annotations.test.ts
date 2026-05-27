import { describe, expect, it } from 'vitest';
import {
  HighlightCreateSchema,
  CommentCreateSchema,
  BookmarkCreateSchema,
  CommentUpdateSchema,
} from '../schemas';

describe('HighlightCreateSchema', () => {
  it('accepts valid highlight with multi-signal locator', () => {
    const result = HighlightCreateSchema.safeParse({
      locator: {
        chapterRef: 'chapter1',
        cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
        selectedText: 'important passage',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe('#ffff00');
    }
  });

  it('accepts valid highlight with color', () => {
    const result = HighlightCreateSchema.safeParse({
      locator: {
        chapterRef: 'chapter1',
        cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
        selectedText: 'text',
      },
      color: '#ff0000',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe('#ff0000');
    }
  });

  it('rejects highlight without locator', () => {
    const result = HighlightCreateSchema.safeParse({ selectedText: 'text' });
    expect(result.success).toBe(false);
  });

  it('rejects highlight without chapterRef', () => {
    const result = HighlightCreateSchema.safeParse({
      locator: {
        cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
        selectedText: 'text',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects highlight without cfi', () => {
    const result = HighlightCreateSchema.safeParse({
      locator: {
        chapterRef: 'chapter1',
        selectedText: 'text',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid color format', () => {
    const result = HighlightCreateSchema.safeParse({
      locator: {
        chapterRef: 'chapter1',
        cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
        selectedText: 'text',
      },
      color: 'red',
    });
    expect(result.success).toBe(false);
  });
});

describe('CommentCreateSchema', () => {
  it('accepts valid comment', () => {
    const result = CommentCreateSchema.safeParse({ body: 'This is a comment.' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe('shared');
    }
  });

  it('rejects empty body', () => {
    const result = CommentCreateSchema.safeParse({ body: '' });
    expect(result.success).toBe(false);
  });

  it('defaults visibility to shared', () => {
    const result = CommentCreateSchema.safeParse({ body: 'comment' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe('shared');
    }
  });
});

describe('BookmarkCreateSchema', () => {
  it('accepts valid bookmark with multi-signal locator', () => {
    const result = BookmarkCreateSchema.safeParse({
      locator: {
        cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
        selectedText: 'important passage',
        chapterRef: 'chapter1',
      },
      label: 'My bookmark',
    });
    expect(result.success).toBe(true);
  });

  it('accepts bookmark without label', () => {
    const result = BookmarkCreateSchema.safeParse({
      locator: {
        cfi: 'epubcfi(/6/4)',
        selectedText: 'text',
        chapterRef: 'ch1',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects bookmark with incomplete locator (missing chapterRef)', () => {
    const result = BookmarkCreateSchema.safeParse({
      locator: {
        cfi: 'epubcfi(/6/4)',
        selectedText: 'text',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects bookmark without locator', () => {
    const result = BookmarkCreateSchema.safeParse({ label: 'orphan' });
    expect(result.success).toBe(false);
  });
});

describe('CommentUpdateSchema', () => {
  it('accepts partial update with body', () => {
    const result = CommentUpdateSchema.safeParse({ body: 'updated' });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with status only', () => {
    const result = CommentUpdateSchema.safeParse({ status: 'resolved' });
    expect(result.success).toBe(true);
  });

  it('rejects empty body', () => {
    const result = CommentUpdateSchema.safeParse({ body: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = CommentUpdateSchema.safeParse({ status: 'unknown' });
    expect(result.success).toBe(false);
  });
});
