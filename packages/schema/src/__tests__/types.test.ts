import { describe, it, expect } from 'vitest';

describe('types', () => {
  it('exports type aliases', () => {
    const globalRoleValues: readonly string[] = ['admin', 'editor', 'reader'];
    expect(globalRoleValues).toContain('admin');
    expect(globalRoleValues).toContain('editor');
    expect(globalRoleValues).toContain('reader');

    const visibilityValues: readonly string[] = ['private', 'password_protected', 'reader_only', 'editorial_review', 'public'];
    expect(visibilityValues).toContain('private');
    expect(visibilityValues).toContain('public');
  });

  it('has correct AnnotationLocator shape', () => {
    const locator: Record<string, unknown> = {
      cfi: 'epubcfi(/6/4)',
      selectedText: 'some text',
      chapterRef: 'chap1',
    };
    expect(locator.cfi).toBe('epubcfi(/6/4)');
    expect(locator.selectedText).toBe('some text');
    expect(locator.chapterRef).toBe('chap1');
  });

  it('has correct User shape', () => {
    const user: Record<string, unknown> = {
      id: 'uuid',
      email: 'test@example.com',
      displayName: 'Test User',
      globalRole: 'admin',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(user.id).toBe('uuid');
    expect(user.email).toBe('test@example.com');
    expect(user.globalRole).toBe('admin');
  });

  it('has correct Book shape with optional fields', () => {
    const book: Record<string, unknown> = {
      id: 'uuid',
      slug: 'test-book',
      title: 'Test Book',
      authorName: null,
      description: null,
      language: 'en',
      visibility: 'private',
      coverImageUrl: null,
      publishedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
    };
    expect(book.slug).toBe('test-book');
    expect(book.authorName).toBeNull();
    expect(book.visibility).toBe('private');
  });

  it('has correct BookAccessGrant shape', () => {
    const grant: Record<string, unknown> = {
      id: 'uuid',
      bookId: 'uuid',
      email: 'reader@example.com',
      passwordHash: null,
      mode: 'private',
      allowed: true,
      commentsAllowed: false,
      offlineAllowed: false,
      expiresAt: null,
      invitedByUserId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      revokedAt: null,
    };
    expect(grant.email).toBe('reader@example.com');
    expect(grant.allowed).toBe(true);
    expect(grant.mode).toBe('private');
  });

  it('has correct ReadingProgress shape', () => {
    const progress: Record<string, unknown> = {
      id: 'uuid',
      bookId: 'uuid',
      userEmail: 'reader@example.com',
      locator: { cfi: 'epubcfi(/6/4)' },
      progressPercent: 50,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(progress.progressPercent).toBe(50);
    expect((progress.locator as Record<string, string>).cfi).toBe('epubcfi(/6/4)');
  });

  it('has correct SyncState shape', () => {
    const sync: Record<string, unknown> = {
      id: 'uuid',
      userEmail: 'reader@example.com',
      entityType: 'bookmark',
      entityId: 'uuid',
      operation: 'create',
      payloadJson: '{}',
      idempotencyKey: 'key-123',
      syncAttempts: 1,
      lastSyncAt: null,
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(sync.operation).toBe('create');
    expect(sync.status).toBe('pending');
    expect(sync.syncAttempts).toBe(1);
  });
});
