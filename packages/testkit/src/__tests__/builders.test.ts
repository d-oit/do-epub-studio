import { describe, it, expect } from 'vitest';
import { createBookBuilder, createBookFileBuilder } from '../book-builder';
import { createGrantBuilder } from '../grant-builder';
import { createSessionBuilder, createExpiredSession, createRevokedSession } from '../session-builder';
import { createCommentBuilder, createHighlightBuilder, createBookmarkBuilder } from '../annotation-builder';
import { createProgressBuilder } from '../progress-builder';

describe('BookBuilder', () => {
  it('builds with defaults', () => {
    const book = createBookBuilder().build();
    expect(book.id).toBeTruthy();
    expect(book.slug).toBe('test-book');
    expect(book.title).toBe('Test Book');
    expect(book.visibility).toBe('private');
  });

  it('builds with custom title', () => {
    const book = createBookBuilder().withTitle('Custom Title').build();
    expect(book.title).toBe('Custom Title');
  });

  it('builds with custom slug', () => {
    const book = createBookBuilder().withSlug('custom-slug').build();
    expect(book.slug).toBe('custom-slug');
  });

  it('builds with custom visibility', () => {
    const book = createBookBuilder().withVisibility('public').build();
    expect(book.visibility).toBe('public');
  });
});

describe('BookFileBuilder', () => {
  it('builds with defaults', () => {
    const file = createBookFileBuilder().build();
    expect(file.id).toBeTruthy();
    expect(file.mimeType).toBe('application/epub+zip');
    expect(file.storageProvider).toBe('r2');
    expect(file.fileSizeBytes).toBeGreaterThan(0);
  });
});

describe('GrantBuilder', () => {
  it('builds with defaults', () => {
    const grant = createGrantBuilder().build();
    expect(grant.id).toBeTruthy();
    expect(grant.email).toBe('reader@example.com');
    expect(grant.mode).toBe('private');
    expect(grant.allowed).toBe(true);
  });

  it('builds with custom email', () => {
    const grant = createGrantBuilder().withEmail('custom@example.com').build();
    expect(grant.email).toBe('custom@example.com');
  });

  it('builds with custom mode', () => {
    const grant = createGrantBuilder().withMode('password_protected').build();
    expect(grant.mode).toBe('password_protected');
  });

  it('builds with password', () => {
    const grant = createGrantBuilder().withPassword('hashed-password').build();
    expect(grant.passwordHash).toBe('hashed-password');
  });

  it('builds with comments allowed', () => {
    const grant = createGrantBuilder().withCommentsAllowed(true).build();
    expect(grant.commentsAllowed).toBe(true);
  });

  it('builds with offline allowed', () => {
    const grant = createGrantBuilder().withOfflineAllowed(true).build();
    expect(grant.offlineAllowed).toBe(true);
  });

  it('builds with expiry', () => {
    const grant = createGrantBuilder().withExpiry('2027-01-01T00:00:00.000Z').build();
    expect(grant.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('builds revoked grant', () => {
    const grant = createGrantBuilder().withRevoked().build();
    expect(grant.revokedAt).toBeTruthy();
  });
});

describe('SessionBuilder', () => {
  it('builds with defaults', () => {
    const session = createSessionBuilder().build();
    expect(session.id).toBeTruthy();
    expect(session.email).toBe('reader@example.com');
    expect(session.revokedAt).toBeNull();
  });

  it('builds with custom email', () => {
    const session = createSessionBuilder().withEmail('admin@example.com').build();
    expect(session.email).toBe('admin@example.com');
  });

  it('builds expired session', () => {
    const session = createExpiredSession().build();
    expect(new Date(session.expiresAt).getTime()).toBeLessThan(Date.now());
  });

  it('builds revoked session', () => {
    const session = createRevokedSession().build();
    expect(session.revokedAt).toBeTruthy();
  });
});

describe('CommentBuilder', () => {
  it('builds with defaults', () => {
    const comment = createCommentBuilder().build();
    expect(comment.id).toBeTruthy();
    expect(comment.body).toBe('Test comment');
    expect(comment.status).toBe('open');
    expect(comment.visibility).toBe('shared');
  });

  it('builds with custom body', () => {
    const comment = createCommentBuilder().withBody('Custom body').build();
    expect(comment.body).toBe('Custom body');
  });

  it('builds with custom status', () => {
    const comment = createCommentBuilder().withStatus('resolved').build();
    expect(comment.status).toBe('resolved');
  });

  it('builds with cfi', () => {
    const comment = createCommentBuilder().withCfi('epubcfi(/6/4)').build();
    expect(comment.cfiRange).toBe('epubcfi(/6/4)');
  });

  it('builds with parent', () => {
    const comment = createCommentBuilder().withParent('parent-id').build();
    expect(comment.parentCommentId).toBe('parent-id');
  });

  it('builds resolved comment', () => {
    const comment = createCommentBuilder().withResolved().build();
    expect(comment.status).toBe('resolved');
    expect(comment.resolvedAt).toBeTruthy();
  });
});

describe('HighlightBuilder', () => {
  it('builds with defaults', () => {
    const highlight = createHighlightBuilder().build();
    expect(highlight.id).toBeTruthy();
    expect(highlight.color).toBe('#ffff00');
    expect(highlight.selectedText).toBeTruthy();
  });

  it('builds with custom text', () => {
    const highlight = createHighlightBuilder().withText('Custom text').build();
    expect(highlight.selectedText).toBe('Custom text');
  });

  it('builds with custom color', () => {
    const highlight = createHighlightBuilder().withColor('#ff0000').build();
    expect(highlight.color).toBe('#ff0000');
  });

  it('builds with note', () => {
    const highlight = createHighlightBuilder().withNote('A note').build();
    expect(highlight.note).toBe('A note');
  });
});

describe('BookmarkBuilder', () => {
  it('builds with defaults', () => {
    const bookmark = createBookmarkBuilder().build();
    expect(bookmark.id).toBeTruthy();
    expect(bookmark.label).toBeNull();
    expect(bookmark.locatorJson).toContain('epubcfi');
  });

  it('builds with custom label', () => {
    const bookmark = createBookmarkBuilder().withLabel('Chapter 1').build();
    expect(bookmark.label).toBe('Chapter 1');
  });

  it('builds with custom locator', () => {
    const bookmark = createBookmarkBuilder().withLocator({ cfi: 'epubcfi(/6/2)' }).build();
    expect(bookmark.locatorJson).toContain('epubcfi(/6/2)');
  });
});

describe('ProgressBuilder', () => {
  it('builds with defaults', () => {
    const progress = createProgressBuilder().build();
    expect(progress.id).toBeTruthy();
    expect(progress.progressPercent).toBe(25.5);
    expect(progress.locatorJson).toContain('epubcfi');
  });

  it('builds with custom percent', () => {
    const progress = createProgressBuilder().withPercent(75).build();
    expect(progress.progressPercent).toBe(75);
  });

  it('builds with custom locator', () => {
    const progress = createProgressBuilder().withLocator({ cfi: 'epubcfi(/6/2:50)' }).build();
    expect(progress.locatorJson).toContain('epubcfi(/6/2:50)');
  });
});
