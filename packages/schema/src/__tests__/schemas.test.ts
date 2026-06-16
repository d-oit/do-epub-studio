import { describe, it, expect } from 'vitest';
import {
  BookVisibilitySchema,
  GrantModeSchema,
  GlobalRoleSchema,
  CommentStatusSchema,
  CommentVisibilitySchema,
  SyncOperationSchema,
  SyncStatusSchema,
  EntityTypeSchema,
  AnnotationLocatorSchema,
  MultiSignalLocatorSchema,
  AccessRequestSchema,
  RecoveryRequestSchema,
  RecoveryVerifySchema,
  CreateBookSchema,
  UpdateBookSchema,
  CreateGrantSchema,
  UpdateGrantSchema,
  ProgressUpdateSchema,
  BookmarkCreateSchema,
  HighlightCreateSchema,
  CommentCreateSchema,
  CommentUpdateSchema,
  CspReportSchema,
  AuditQuerySchema,
  LoginSchema,
  ValidateQuerySchema,
  SignedUrlSchema,
  UploadCompleteSchema,
  formatZodError,
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

  describe('GlobalRoleSchema', () => {
    it('accepts valid values', () => {
      expect(GlobalRoleSchema.parse('admin')).toBe('admin');
      expect(GlobalRoleSchema.parse('editor')).toBe('editor');
      expect(GlobalRoleSchema.parse('reader')).toBe('reader');
    });

    it('rejects invalid values', () => {
      expect(() => GlobalRoleSchema.parse('superadmin')).toThrow();
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

  describe('SyncOperationSchema', () => {
    it('accepts valid values', () => {
      expect(SyncOperationSchema.parse('create')).toBe('create');
      expect(SyncOperationSchema.parse('update')).toBe('update');
      expect(SyncOperationSchema.parse('delete')).toBe('delete');
    });
  });

  describe('SyncStatusSchema', () => {
    it('accepts valid values', () => {
      expect(SyncStatusSchema.parse('pending')).toBe('pending');
      expect(SyncStatusSchema.parse('synced')).toBe('synced');
      expect(SyncStatusSchema.parse('failed')).toBe('failed');
      expect(SyncStatusSchema.parse('conflict')).toBe('conflict');
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

describe('AnnotationLocatorSchema', () => {
  it('accepts locator with cfi', () => {
    const result = AnnotationLocatorSchema.parse({ cfi: 'epubcfi(/6/4)' });
    expect(result.cfi).toBe('epubcfi(/6/4)');
  });

  it('accepts locator with selectedText', () => {
    const result = AnnotationLocatorSchema.parse({ selectedText: 'hello world' });
    expect(result.selectedText).toBe('hello world');
  });

  it('accepts locator with both cfi and selectedText', () => {
    const result = AnnotationLocatorSchema.parse({ cfi: 'cfi', selectedText: 'text' });
    expect(result.cfi).toBe('cfi');
    expect(result.selectedText).toBe('text');
  });

  it('rejects locator with neither cfi nor selectedText', () => {
    expect(() => AnnotationLocatorSchema.parse({ chapterRef: 'ch1' })).toThrow('Locator must have at least cfi or selectedText');
  });

  it('enforces max length for cfi', () => {
    expect(() => AnnotationLocatorSchema.parse({ cfi: 'x'.repeat(2049) })).toThrow();
  });

  it('enforces max length for selectedText', () => {
    expect(() => AnnotationLocatorSchema.parse({ selectedText: 'x'.repeat(10001) })).toThrow();
  });

  it('enforces max length for chapterRef', () => {
    expect(() => AnnotationLocatorSchema.parse({ cfi: 'cfi', chapterRef: 'x'.repeat(1025) })).toThrow();
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

describe('AccessRequestSchema', () => {
  it('accepts valid request', () => {
    const result = AccessRequestSchema.parse({ bookSlug: 'my-book', email: 'a@b.com' });
    expect(result.bookSlug).toBe('my-book');
    expect(result.email).toBe('a@b.com');
  });

  it('accepts request with password', () => {
    const result = AccessRequestSchema.parse({ bookSlug: 'book', email: 'a@b.com', password: 'pass123' });
    expect(result.password).toBe('pass123');
  });

  it('rejects invalid email', () => {
    expect(() => AccessRequestSchema.parse({ bookSlug: 'book', email: 'not-an-email' })).toThrow();
  });

  it('rejects empty bookSlug', () => {
    expect(() => AccessRequestSchema.parse({ bookSlug: '', email: 'a@b.com' })).toThrow();
  });
});

describe('RecoveryRequestSchema', () => {
  it('accepts valid request', () => {
    const result = RecoveryRequestSchema.parse({ bookSlug: 'book', email: 'a@b.com' });
    expect(result.bookSlug).toBe('book');
  });
});

describe('RecoveryVerifySchema', () => {
  it('accepts valid token', () => {
    const result = RecoveryVerifySchema.parse({ token: 'abc123' });
    expect(result.token).toBe('abc123');
  });

  it('rejects empty token', () => {
    expect(() => RecoveryVerifySchema.parse({ token: '' })).toThrow();
  });
});

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

describe('CreateGrantSchema', () => {
  it('accepts valid grant', () => {
    const result = CreateGrantSchema.parse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'reader@example.com',
    });
    expect(result.mode).toBe('private');
    expect(result.commentsAllowed).toBe(false);
    expect(result.offlineAllowed).toBe(false);
  });

  it('accepts grant with optional fields', () => {
    const result = CreateGrantSchema.parse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'reader@example.com',
      password: 'password123',
      mode: 'public',
      commentsAllowed: true,
      offlineAllowed: true,
      expiresAt: '2025-12-31T23:59:59.000Z',
    });
    expect(result.mode).toBe('public');
    expect(result.commentsAllowed).toBe(true);
  });

  it('rejects invalid bookId UUID', () => {
    expect(() => CreateGrantSchema.parse({ bookId: 'not-a-uuid', email: 'a@b.com' })).toThrow();
  });

  it('rejects password shorter than 8 chars', () => {
    expect(() => CreateGrantSchema.parse({
      bookId: '550e8400-e29b-41d4-a716-446655440000',
      email: 'a@b.com',
      password: 'short',
    })).toThrow();
  });
});

describe('UpdateGrantSchema', () => {
  it('accepts partial update', () => {
    const result = UpdateGrantSchema.parse({ mode: 'public' });
    expect(result.mode).toBe('public');
  });

  it('accepts null expiresAt', () => {
    const result = UpdateGrantSchema.parse({ expiresAt: null });
    expect(result.expiresAt).toBeNull();
  });
});

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

describe('CspReportSchema', () => {
  it('accepts valid CSP report', () => {
    const result = CspReportSchema.parse({
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'violated-directive': "script-src 'self'",
      },
    });
    expect(result['csp-report']['document-uri']).toBe('https://example.com/page');
  });

  it('accepts report with optional fields', () => {
    const result = CspReportSchema.parse({
      'csp-report': {
        'document-uri': 'https://example.com',
        'referrer': 'https://google.com',
        'blocked-uri': 'https://evil.com/script.js',
        'violated-directive': "script-src 'self'",
        'effective-directive': "script-src",
        'original-policy': "script-src 'self'",
        'disposition': 'enforce',
        'status-code': 200,
        'script-sample': 'alert(1)',
      },
    });
    expect(result['csp-report']['disposition']).toBe('enforce');
  });

  it('rejects invalid document-uri', () => {
    expect(() => CspReportSchema.parse({
      'csp-report': {
        'document-uri': 'not-a-url',
        'violated-directive': "script-src 'self'",
      },
    })).toThrow();
  });
});

describe('AuditQuerySchema', () => {
  it('accepts valid query', () => {
    const result = AuditQuerySchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('accepts query with string limit (coerced)', () => {
    const result = AuditQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('accepts query with filters', () => {
    const result = AuditQuerySchema.parse({
      entityType: 'book',
      entityId: 'b1',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-12-31T23:59:59.000Z',
    });
    expect(result.entityType).toBe('book');
  });

  it('rejects limit > 100', () => {
    expect(() => AuditQuerySchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects negative offset', () => {
    expect(() => AuditQuerySchema.parse({ offset: -1 })).toThrow();
  });
});

describe('LoginSchema', () => {
  it('accepts valid login', () => {
    const result = LoginSchema.parse({ email: 'a@b.com', password: 'pass123' });
    expect(result.email).toBe('a@b.com');
  });

  it('rejects empty password', () => {
    expect(() => LoginSchema.parse({ email: 'a@b.com', password: '' })).toThrow();
  });
});

describe('ValidateQuerySchema', () => {
  it('accepts valid query', () => {
    const result = ValidateQuerySchema.parse({ bookId: 'book-1' });
    expect(result.bookId).toBe('book-1');
  });
});

describe('SignedUrlSchema', () => {
  it('accepts valid signed URL', () => {
    const result = SignedUrlSchema.parse({ expires: '1234567890', signature: 'abc123' });
    expect(result.expires).toBe('1234567890');
    expect(result.signature).toBe('abc123');
  });
});

describe('UploadCompleteSchema', () => {
  it('accepts valid upload', () => {
    const result = UploadCompleteSchema.parse({
      storageKey: 'books/book-1/epub.epub',
      originalFilename: 'my-book.epub',
    });
    expect(result.storageKey).toBe('books/book-1/epub.epub');
  });

  it('accepts upload with optional fields', () => {
    const result = UploadCompleteSchema.parse({
      storageKey: 'key',
      originalFilename: 'file.epub',
      mimeType: 'application/epub+zip',
      fileSizeBytes: 1024,
      sha256: 'abc123',
      epubVersion: '3.0',
      validationResults: {
        isValid: true,
        errors: [],
        warnings: [],
      },
    });
    expect(result.fileSizeBytes).toBe(1024);
  });

  it('rejects empty storageKey', () => {
    expect(() => UploadCompleteSchema.parse({ storageKey: '', originalFilename: 'file.epub' })).toThrow();
  });
});

describe('formatZodError', () => {
  it('formats error with path', () => {
    const error = {
      issues: [
        { path: ['email'], message: 'Invalid email' },
      ],
    };
    expect(formatZodError(error)).toBe('email: Invalid email');
  });

  it('formats error without path', () => {
    const error = {
      issues: [
        { path: [], message: 'Required' },
      ],
    };
    expect(formatZodError(error)).toBe('Required');
  });

  it('formats multiple errors', () => {
    const error = {
      issues: [
        { path: ['email'], message: 'Invalid' },
        { path: ['password'], message: 'Too short' },
      ],
    };
    expect(formatZodError(error)).toBe('email: Invalid; password: Too short');
  });

  it('formats nested path', () => {
    const error = {
      issues: [
        { path: ['user', 'email'], message: 'Invalid' },
      ],
    };
    expect(formatZodError(error)).toBe('user.email: Invalid');
  });
});
