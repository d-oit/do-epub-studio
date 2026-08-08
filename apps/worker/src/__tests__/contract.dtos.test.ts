/**
 * Contract tests: shared DTO round-trips + Worker route envelope.
 * fixtures must be imported before ../app so vi.mock calls register first.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv, makePassThroughContext,
  mockValidateGrant, mockCreateSession, mockValidateSessionMod,
} from './fixtures';
import { app } from '../app';
import {
  AccessRequestSchema, RecoveryRequestSchema, RecoveryVerifySchema,
  CreateBookSchema, UpdateBookSchema,
  CreateGrantSchema, UpdateGrantSchema,
  ProgressUpdateSchema, BookmarkCreateSchema, HighlightCreateSchema,
  CommentCreateSchema, CommentUpdateSchema,
  TelemetryPayloadSchema, UploadCompleteSchema,
  type ApiResponse, type ApiError,
} from '@do-epub-studio/shared';
import {
  createBookBuilder, createGrantBuilder, createProgressBuilder,
  createBookmarkBuilder, createHighlightBuilder, createCommentBuilder,
} from '@do-epub-studio/testkit';

vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }),
  deleteRateLimitKey: vi.fn().mockResolvedValue(undefined),
}));

const msLocator = { cfi: 'epubcfi(/6/4[chap01]!/4/2/1:0)', selectedText: 'A passage', chapterRef: 'ch01' };

// ── 1. Zod schema round-trips ────────────────────────────────────────────────

describe('Shared DTO schema round-trips', () => {
  it('AccessRequestSchema — accepts valid, rejects missing email', () => {
    expect(AccessRequestSchema.safeParse({ bookSlug: 'b', email: 'r@example.com', password: 'pw' }).success).toBe(true);
    const bad = AccessRequestSchema.safeParse({ bookSlug: 'b' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues.length).toBeGreaterThan(0);
  });

  it('RecoveryRequestSchema — accepts valid, rejects invalid email', () => {
    expect(RecoveryRequestSchema.safeParse({ bookSlug: 'b', email: 'r@example.com' }).success).toBe(true);
    expect(RecoveryRequestSchema.safeParse({ bookSlug: 'b', email: 'not-email' }).success).toBe(false);
  });

  it('RecoveryVerifySchema — accepts token, rejects empty', () => {
    expect(RecoveryVerifySchema.safeParse({ token: 'abc.def' }).success).toBe(true);
    expect(RecoveryVerifySchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('CreateBookSchema — accepts builder data, rejects missing title', () => {
    const b = createBookBuilder().build();
    expect(CreateBookSchema.safeParse({ title: b.title, slug: b.slug, language: b.language, visibility: b.visibility }).success).toBe(true);
    expect(CreateBookSchema.safeParse({ slug: 'only-slug' }).success).toBe(false);
  });

  it('UpdateBookSchema — accepts partial, rejects bad visibility', () => {
    expect(UpdateBookSchema.safeParse({ title: 'New' }).success).toBe(true);
    expect(UpdateBookSchema.safeParse({ visibility: 'bad_value' }).success).toBe(false);
  });

  it('CreateGrantSchema — accepts builder data, rejects non-uuid bookId', () => {
    const g = createGrantBuilder().build();
    expect(CreateGrantSchema.safeParse({ bookId: g.bookId, email: g.email, mode: g.mode }).success).toBe(true);
    expect(CreateGrantSchema.safeParse({ bookId: 'not-uuid', email: 'a@b.com' }).success).toBe(false);
  });

  it('UpdateGrantSchema — accepts empty object, rejects bad mode', () => {
    expect(UpdateGrantSchema.safeParse({}).success).toBe(true);
    expect(UpdateGrantSchema.safeParse({ mode: 'superadmin' }).success).toBe(false);
  });

  it('ProgressUpdateSchema — accepts builder percent, rejects >100', () => {
    const p = createProgressBuilder().build();
    const cfi = (JSON.parse(p.locatorJson) as { cfi: string }).cfi;
    expect(ProgressUpdateSchema.safeParse({ locator: { ...msLocator, cfi }, progressPercent: p.progressPercent }).success).toBe(true);
    expect(ProgressUpdateSchema.safeParse({ locator: msLocator, progressPercent: 101 }).success).toBe(false);
  });

  it('BookmarkCreateSchema — accepts valid, rejects locator missing chapterRef', () => {
    const bm = createBookmarkBuilder().withLabel('x').build();
    expect(BookmarkCreateSchema.safeParse({ locator: msLocator, label: bm.label }).success).toBe(true);
    expect(BookmarkCreateSchema.safeParse({ locator: { cfi: 'epubcfi(/1)', selectedText: 'hi' } }).success).toBe(false);
  });

  it('HighlightCreateSchema — accepts builder color, rejects non-hex color', () => {
    const hl = createHighlightBuilder().withColor('#ff0000').build();
    expect(HighlightCreateSchema.safeParse({ locator: msLocator, color: hl.color }).success).toBe(true);
    expect(HighlightCreateSchema.safeParse({ locator: msLocator, color: 'red' }).success).toBe(false);
  });

  it('CommentCreateSchema — accepts builder body, rejects empty body', () => {
    const c = createCommentBuilder().withBody('Nice!').build();
    expect(CommentCreateSchema.safeParse({ body: c.body, visibility: c.visibility }).success).toBe(true);
    expect(CommentCreateSchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('CommentUpdateSchema — accepts valid status, rejects unknown status', () => {
    expect(CommentUpdateSchema.safeParse({ status: 'resolved' }).success).toBe(true);
    expect(CommentUpdateSchema.safeParse({ status: 'pending' }).success).toBe(false);
  });

  it('TelemetryPayloadSchema — accepts valid batch, rejects bad level', () => {
    expect(TelemetryPayloadSchema.safeParse({ logs: [{ level: 'info', traceId: 't', event: 'e' }] }).success).toBe(true);
    expect(TelemetryPayloadSchema.safeParse({ logs: [{ level: 'verbose', traceId: 't', event: 'e' }] }).success).toBe(false);
  });

  it('UploadCompleteSchema — accepts valid upload, rejects empty storageKey', () => {
    expect(UploadCompleteSchema.safeParse({ storageKey: 'books/x/f.epub', originalFilename: 'f.epub' }).success).toBe(true);
    expect(UploadCompleteSchema.safeParse({ storageKey: '', originalFilename: 'f.epub' }).success).toBe(false);
  });
});

// ── 2. Route envelope verification ──────────────────────────────────────────

describe('Worker route envelope contract', () => {
  const env = makeEnv();

  beforeEach(() => { vi.clearAllMocks(); });

  it('GET /api/access/validate — 401 carries { ok: false, error: { code, message } }', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false, session: null });

    const res = await app.fetch(
      new Request('http://localhost/api/access/validate?bookId=b-1'),
      env, makePassThroughContext(),
    );
    expect(res.status).toBe(401);
    const body: ApiResponse = await res.json();
    expect(body.ok).toBe(false);
    const err = body.error as ApiError;
    expect(typeof err.code).toBe('string');
    expect(typeof err.message).toBe('string');
    expect(err.code).toBe('SESSION_INVALID');
  });

  it('POST /api/access/request — 200 carries { ok: true, data: { sessionToken } }', async () => {
    mockValidateGrant.mockResolvedValue({
      valid: true,
      grant: { id: 'g-1', book_id: 'b-1', email: 'r@example.com', password_hash: null,
               mode: 'private', allowed: 1, comments_allowed: 0, offline_allowed: 0,
               expires_at: null, revoked_at: null },
      book: { id: 'b-1', slug: 'test-book', title: 'Test Book',
              author_name: null, visibility: 'private', cover_image_url: null },
    });
    mockCreateSession.mockResolvedValue({ token: 'tok-abc', expiresAt: '2030-01-01T00:00:00.000Z' });

    const res = await app.fetch(
      new Request('http://localhost/api/access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSlug: 'test-book', email: 'r@example.com', password: 'pw' }),
      }),
      env, makePassThroughContext(),
    );
    expect(res.status).toBe(200);
    const body: ApiResponse<{ sessionToken: string }> = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.error).toBeUndefined();
    expect(typeof (body.data as { sessionToken: string }).sessionToken).toBe('string');
  });

  it('POST /api/access/request — 400 validation error: ok=false or success=false', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/access/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // missing bookSlug and email
      }),
      env, makePassThroughContext(),
    );
    expect(res.status).toBe(400);
    // validationErrorFormatter normalises zValidator errors; accept either format
    const body: Record<string, unknown> = await res.json();
    expect(body.ok === false || body.success === false).toBe(true);
  });
});
