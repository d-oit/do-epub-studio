import { describe, it, expect } from 'vitest';
import { createBookBuilder, createBookFileBuilder } from '../book-builder';
import { createGrantBuilder } from '../grant-builder';
import { createSessionBuilder } from '../session-builder';
import { createCommentBuilder, createHighlightBuilder, createBookmarkBuilder } from '../annotation-builder';
import { createProgressBuilder } from '../progress-builder';

// Exhaustive deterministic-default assertions for every field of every builder.
// Fields that are random (id, bookId, timestamps) are asserted for presence + shape.

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('BookBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const book = createBookBuilder().build();
    expect(typeof book.id).toBe('string');
    expect(book.id.length).toBeGreaterThan(0);
    expect(book.slug).toBe('test-book');
    expect(book.title).toBe('Test Book');
    expect(book.authorName).toBe('Test Author');
    expect(book.description).toBeNull();
    expect(book.language).toBe('en');
    expect(book.visibility).toBe('private');
    expect(book.coverImageUrl).toBeNull();
    expect(book.publishedAt).toBeNull();
    expect(book.createdAt).toMatch(ISO_RE);
    expect(book.updatedAt).toMatch(ISO_RE);
    expect(book.archivedAt).toBeNull();
  });
});

describe('BookFileBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const file = createBookFileBuilder().build();
    expect(typeof file.id).toBe('string');
    expect(file.id.length).toBeGreaterThan(0);
    expect(typeof file.bookId).toBe('string');
    expect(file.bookId.length).toBeGreaterThan(0);
    expect(file.storageProvider).toBe('r2');
    expect(file.storageKey).toBe(`books/${file.bookId}/epub/file.epub`);
    expect(file.originalFilename).toBe('test.epub');
    expect(file.mimeType).toBe('application/epub+zip');
    expect(file.fileSizeBytes).toBe(1024 * 100);
    expect(file.sha256).toBeNull();
    expect(file.epubVersion).toBe('3.0');
    expect(file.manifestJson).toBeNull();
    expect(file.createdAt).toMatch(ISO_RE);
  });
});

describe('GrantBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const grant = createGrantBuilder().build();
    expect(typeof grant.id).toBe('string');
    expect(grant.id.length).toBeGreaterThan(0);
    expect(typeof grant.bookId).toBe('string');
    expect(grant.bookId.length).toBeGreaterThan(0);
    expect(grant.email).toBe('reader@example.com');
    expect(grant.passwordHash).toBeNull();
    expect(grant.mode).toBe('private');
    expect(grant.allowed).toBe(true);
    expect(grant.commentsAllowed).toBe(false);
    expect(grant.offlineAllowed).toBe(false);
    expect(grant.expiresAt).toBeNull();
    expect(grant.invitedByUserId).toBeNull();
    expect(grant.createdAt).toMatch(ISO_RE);
    expect(grant.updatedAt).toMatch(ISO_RE);
    expect(grant.revokedAt).toBeNull();
  });
});

describe('SessionBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const session = createSessionBuilder().build();
    expect(typeof session.id).toBe('string');
    expect(session.id.length).toBeGreaterThan(0);
    expect(typeof session.bookId).toBe('string');
    expect(session.bookId.length).toBeGreaterThan(0);
    expect(session.email).toBe('reader@example.com');
    expect(session.sessionTokenHash).toBe('hashed-token');
    expect(session.revokedAt).toBeNull();
    expect(session.createdAt).toMatch(ISO_RE);
    // Default expiry is ~15 minutes in the future.
    const expiry = new Date(session.expiresAt).getTime();
    const now = Date.now();
    expect(expiry).toBeGreaterThan(now);
    expect(expiry).toBeLessThanOrEqual(now + 16 * 60 * 1000);
  });
});

describe('CommentBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const comment = createCommentBuilder().build();
    expect(typeof comment.id).toBe('string');
    expect(comment.id.length).toBeGreaterThan(0);
    expect(typeof comment.bookId).toBe('string');
    expect(comment.bookId.length).toBeGreaterThan(0);
    expect(comment.userEmail).toBe('reviewer@example.com');
    expect(comment.chapterRef).toBeNull();
    expect(comment.cfiRange).toBeNull();
    expect(comment.selectedText).toBeNull();
    expect(comment.body).toBe('Test comment');
    expect(comment.status).toBe('open');
    expect(comment.visibility).toBe('shared');
    expect(comment.parentCommentId).toBeNull();
    expect(comment.createdAt).toMatch(ISO_RE);
    expect(comment.updatedAt).toMatch(ISO_RE);
    expect(comment.resolvedAt).toBeNull();
  });
});

describe('HighlightBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const highlight = createHighlightBuilder().build();
    expect(typeof highlight.id).toBe('string');
    expect(highlight.id.length).toBeGreaterThan(0);
    expect(typeof highlight.bookId).toBe('string');
    expect(highlight.bookId.length).toBeGreaterThan(0);
    expect(highlight.userEmail).toBe('reader@example.com');
    expect(highlight.chapterRef).toBeNull();
    expect(highlight.cfiRange).toBeNull();
    expect(highlight.selectedText).toBe('Selected text from book');
    expect(highlight.note).toBeNull();
    expect(highlight.color).toBe('#ffff00');
    expect(highlight.createdAt).toMatch(ISO_RE);
    expect(highlight.updatedAt).toMatch(ISO_RE);
  });
});

describe('BookmarkBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const bookmark = createBookmarkBuilder().build();
    expect(typeof bookmark.id).toBe('string');
    expect(bookmark.id.length).toBeGreaterThan(0);
    expect(typeof bookmark.bookId).toBe('string');
    expect(bookmark.bookId.length).toBeGreaterThan(0);
    expect(bookmark.userEmail).toBe('reader@example.com');
    expect(bookmark.locatorJson).toContain('epubcfi');
    expect(bookmark.label).toBeNull();
    expect(bookmark.createdAt).toMatch(ISO_RE);
  });
});

describe('ProgressBuilder defaults', () => {
  it('exposes every default field deterministically', () => {
    const progress = createProgressBuilder().build();
    expect(typeof progress.id).toBe('string');
    expect(progress.id.length).toBeGreaterThan(0);
    expect(typeof progress.bookId).toBe('string');
    expect(progress.bookId.length).toBeGreaterThan(0);
    expect(progress.userEmail).toBe('reader@example.com');
    expect(progress.locatorJson).toContain('epubcfi');
    expect(progress.progressPercent).toBe(25.5);
    expect(progress.updatedAt).toMatch(ISO_RE);
  });
});