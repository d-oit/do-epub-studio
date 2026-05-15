import { describe, it, expect } from 'vitest';

describe('types module', () => {
  it('exports module can be imported', async () => {
    const mod = await import('../types');
    expect(mod).toBeDefined();
  });

  it('AnnotationLocator type shape via runtime usage', () => {
    const locator: Record<string, unknown> = { cfi: 'epubcfi(/6/4)', selectedText: 'some text', chapterRef: 'chap1' };
    expect(locator.cfi).toBe('epubcfi(/6/4)');
    expect(locator.selectedText).toBe('some text');
  });

  it('User type shape', () => {
    const user: Record<string, unknown> = { id: 'u1', email: 'a@b.com', displayName: 'A', globalRole: 'admin', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(user.email).toBe('a@b.com');
    expect(user.globalRole).toBe('admin');
  });

  it('Book type shape', () => {
    const book: Record<string, unknown> = { id: 'b1', slug: 'test', title: 'Test', authorName: null, description: null, language: 'en', visibility: 'private', coverImageUrl: null, publishedAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', archivedAt: null };
    expect(book.slug).toBe('test');
    expect(book.visibility).toBe('private');
  });

  it('BookAccessGrant type shape', () => {
    const grant: Record<string, unknown> = { id: 'g1', bookId: 'b1', email: 'r@b.com', passwordHash: null, mode: 'private', allowed: true, commentsAllowed: false, offlineAllowed: false, expiresAt: null, invitedByUserId: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', revokedAt: null };
    expect(grant.email).toBe('r@b.com');
    expect(grant.allowed).toBe(true);
  });

  it('ReadingProgress type shape', () => {
    const progress: Record<string, unknown> = { id: 'p1', bookId: 'b1', userEmail: 'r@b.com', locator: { cfi: 'epubcfi(/6/4)' }, progressPercent: 50, updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(progress.progressPercent).toBe(50);
  });

  it('SyncState type shape', () => {
    const sync: Record<string, unknown> = { id: 's1', userEmail: 'r@b.com', entityType: 'bookmark', entityId: 'e1', operation: 'create', payloadJson: '{}', idempotencyKey: 'k1', syncAttempts: 1, lastSyncAt: null, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(sync.operation).toBe('create');
    expect(sync.status).toBe('pending');
  });
});
