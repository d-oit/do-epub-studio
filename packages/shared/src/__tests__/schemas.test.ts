import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  AnnotationLocatorSchema,
  AccessRequestSchema,
  CreateBookSchema,
  CreateGrantSchema,
  // UpdateGrantSchema,
  ProgressUpdateSchema,
  BookmarkCreateSchema,
  HighlightCreateSchema,
  CommentCreateSchema,
  CommentUpdateSchema,
  MultiSignalLocatorSchema,
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

describe('MultiSignalLocatorSchema', () => {
  it('accepts valid multi-signal locator with all fields', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4[chapter1]!/4/2/1:0)',
      selectedText: 'important passage',
      chapterRef: 'chapter1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects locator with empty cfi string', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: '',
      selectedText: 'text',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('CFI is required');
    }
  });

  it('rejects locator with empty selectedText', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: '',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Selected text is required');
    }
  });

  it('rejects locator with empty chapterRef', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text',
      chapterRef: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Chapter reference is required');
    }
  });

  it('rejects locator missing cfi field entirely', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      selectedText: 'text',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects locator missing selectedText field entirely', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      chapterRef: 'ch1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects locator missing chapterRef field entirely', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = MultiSignalLocatorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects extra fields via strict()', () => {
    const result = MultiSignalLocatorSchema.safeParse({
      cfi: 'epubcfi(/6/4)',
      selectedText: 'text',
      chapterRef: 'ch1',
      extraField: 'should-not-exist',
    });
    expect(result.success).toBe(false);
  });
});

describe('ProgressUpdateSchema', () => {
  it('accepts valid progress with multi-signal locator', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'ch1' },
      progressPercent: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects progress with incomplete locator', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)' },
      progressPercent: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects progressPercent below 0', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'ch1' },
      progressPercent: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects progressPercent above 100', () => {
    const result = ProgressUpdateSchema.safeParse({
      locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text', chapterRef: 'ch1' },
      progressPercent: 101,
    });
    expect(result.success).toBe(false);
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

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('MultiSignalLocatorSchema (property)', () => {
  it('accepts any valid combination of non-empty strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (cfi, selectedText, chapterRef) => {
          const result = MultiSignalLocatorSchema.safeParse({ cfi, selectedText, chapterRef });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.cfi).toBe(cfi);
            expect(result.data.selectedText).toBe(selectedText);
            expect(result.data.chapterRef).toBe(chapterRef);
          }
        },
      ),
    );
  });

  it('rejects input missing any required field', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        (cfi, selectedText, chapterRef) => {
          const input: Record<string, string> = {};
          if (cfi !== undefined) input.cfi = cfi;
          if (selectedText !== undefined) input.selectedText = selectedText;
          if (chapterRef !== undefined) input.chapterRef = chapterRef;
          if (cfi === undefined || selectedText === undefined || chapterRef === undefined) {
            const result = MultiSignalLocatorSchema.safeParse(input);
            expect(result.success).toBe(false);
          }
        },
      ),
    );
  });

  it('rejects input with extra unknown keys', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        (cfi, selectedText, chapterRef, extraKey) => {
          fc.pre(extraKey.length > 0 && extraKey !== 'cfi' && extraKey !== 'selectedText' && extraKey !== 'chapterRef');
          fc.pre(extraKey !== '__proto__');
          const result = MultiSignalLocatorSchema.safeParse({
            cfi,
            selectedText,
            chapterRef,
            [extraKey]: 'some value',
          });
          expect(result.success).toBe(false);
        },
      ),
    );
  });

  it('rejects empty string for any required field', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('cfi', 'selectedText', 'chapterRef'),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (emptyField, a, b) => {
          const input: Record<string, string> = {};
          input[emptyField] = '';
          if (emptyField !== 'cfi') input.cfi = a;
          if (emptyField !== 'selectedText') input.selectedText = a;
          if (emptyField !== 'chapterRef') input.chapterRef = b;
          const result = MultiSignalLocatorSchema.safeParse(input);
          expect(result.success).toBe(false);
        },
      ),
    );
  });
});
