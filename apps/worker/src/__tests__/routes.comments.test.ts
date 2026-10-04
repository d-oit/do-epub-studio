import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeAuthContext,
  makePassThroughContext,
  mockQueryFirst,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
  mockGetGrantByBookAndSession,
  mockComputeCapabilities,
} from './fixtures';
import { app } from '../app';
import { assertBookAccess } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;

describe('Comments Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
  });

  describe('GET /api/books/:bookId/comments', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/comments'),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(401);
    });

    it('returns list of comments when authenticated', async () => {
      mockRequireAuth.mockResolvedValue(makeAuthContext());
      mockGetGrantByBookAndSession.mockResolvedValue({ id: 'grant-1' });

      mockQueryAll.mockResolvedValue([
        {
          id: '1',
          body: 'cool',
          user_email: 'other@ex.com',
          status: 'open',
          visibility: 'shared',
          created_at: 'now',
          updated_at: 'now',
        },
      ]);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/comments', {
          headers: { Authorization: 'Bearer valid' },
        }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(200);
      const body: Record<string, unknown> = await res.json();
      expect(body.data).toHaveLength(1);
      // B1 (GOAP-224 W1.3): shared-comment payload must mask author email —
      // displayName is a truncated identifier and no userEmail key leaks.
      const data = body.data as Array<Record<string, unknown>>;
      const comment = data[0];
      expect(comment?.displayName).toBe('ot***');
      expect(comment.isOwn).toBe(false);
      expect('userEmail' in comment).toBe(false);
      expect('user_email' in comment).toBe(false);
    });

    it('maps the locator columns onto the flat client fields', async () => {
      // `comments` stores the locator as chapter_ref/cfi_range/selected_text and
      // the client's Comment type reads those flat names; returning a nested
      // `locator` left the reader with no quoted passage.
      mockRequireAuth.mockResolvedValue(makeAuthContext());
      mockGetGrantByBookAndSession.mockResolvedValue({ id: 'grant-1' });
      mockQueryAll.mockResolvedValue([
        {
          id: 'c1',
          body: 'quoted',
          user_email: 'user@example.com',
          status: 'open',
          visibility: 'shared',
          chapter_ref: 'ch1.xhtml',
          cfi_range: 'epubcfi(/6/2!/4/4[p1])',
          selected_text: 'A passage',
          parent_comment_id: null,
          resolved_at: '2026-01-01T00:00:00Z',
          created_at: 'now',
          updated_at: 'now',
        },
      ]);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/comments', {
          headers: { Authorization: 'Bearer valid' },
        }),
        env,
        makePassThroughContext(),
      );

      const body: { data: Array<Record<string, unknown>> } = await res.json();
      expect(body.data[0]).toMatchObject({
        chapterRef: 'ch1.xhtml',
        cfiRange: 'epubcfi(/6/2!/4/4[p1])',
        selectedText: 'A passage',
        resolvedAt: '2026-01-01T00:00:00Z',
      });
      expect(body.data[0]).not.toHaveProperty('locator');
    });
  });

  describe('POST /api/books/:bookId/comments', () => {
    it('creates comment and returns success', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-1',
        capabilities: { canComment: true },
      });
      mockGetGrantByBookAndSession.mockResolvedValue({ id: 'grant-1' });
      mockComputeCapabilities.mockReturnValue({ canComment: true });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/comments', {
          method: 'POST',
          body: JSON.stringify({
            body: 'new comment',
            visibility: 'shared',
            locator: {
              cfi: 'epubcfi(/6/2!/4/4[p1])',
              chapterRef: 'ch1.xhtml',
              selectedText: 'A passage',
            },
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid',
          },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(201);
      const payload: { data: Record<string, unknown> } = await res.json();
      // The response speaks the same flat shape as the list.
      expect(payload.data).toMatchObject({
        cfiRange: 'epubcfi(/6/2!/4/4[p1])',
        chapterRef: 'ch1.xhtml',
        selectedText: 'A passage',
      });

      const insert = mockExecute.mock.calls.find((args) =>
        String(args[1]).includes('INSERT INTO comments'),
      );
      const sql = String(insert?.[1]);
      // Only columns the comments table actually has: the previous INSERT named
      // `locator_json`, which no migration defines, so every create 500ed.
      expect(sql).toContain('chapter_ref');
      expect(sql).toContain('cfi_range');
      expect(sql).toContain('selected_text');
      expect(sql).not.toContain('locator_json');
      const placeholders = (sql.match(/\?/g) ?? []).length;
      expect(insert?.[2]).toHaveLength(placeholders);
      expect(insert?.[2]).toContain('epubcfi(/6/2!/4/4[p1])');
    });
  });

  describe('PATCH /api/comments/:commentId', () => {
    it('updates comment when owned by user', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-1',
        capabilities: { canComment: true },
      });

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com', book_id: 'book-1' });

      const res = await app.fetch(
        new Request('http://localhost/api/comments/1', {
          method: 'PATCH',
          body: JSON.stringify({ body: 'updated body' }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid',
          },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
    });

    it('rejects update from read-only session', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-1',
        capabilities: { canComment: false },
      });

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com', book_id: 'book-1' });

      const res = await app.fetch(
        new Request('http://localhost/api/comments/1', {
          method: 'PATCH',
          body: JSON.stringify({ body: 'updated body' }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer valid',
          },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/comments/:commentId', () => {
    it('deletes comment when owned by user', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-1',
        capabilities: { canComment: true },
      });

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com', book_id: 'book-1' });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(
        new Request('http://localhost/api/comments/1', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
    });

    it('rejects delete from read-only session', async () => {
      mockRequireAuth.mockResolvedValue({
        email: 'user@example.com',
        bookId: 'book-1',
        capabilities: { canComment: false },
      });

      mockQueryFirst.mockResolvedValue({ user_email: 'user@example.com', book_id: 'book-1' });

      const res = await app.fetch(
        new Request('http://localhost/api/comments/1', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(403);
    });
  });
});
