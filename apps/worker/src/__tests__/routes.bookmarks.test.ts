import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
  mockExecute,
  mockRequireAuth,
} from './fixtures';
import { app } from '../app';
import type { AuthContext } from '../auth/middleware';
import { assertBookAccess, parseLocatorRow } from '../lib/tenant-isolation';

vi.mock('../lib/tenant-isolation', () => ({
  parseLocatorRow: vi.fn(),
  assertBookAccess: vi.fn(),
}));

const mockAssertBookAccess = assertBookAccess as ReturnType<typeof vi.fn>;
const mockParseLocatorRow = parseLocatorRow as ReturnType<typeof vi.fn>;

const authCtx: AuthContext = {
  email: 'user@example.com',
  sessionId: 'session-1',
  bookId: 'book-1',
  capabilities: {
    canRead: true,
    canComment: true,
    canHighlight: true,
    canBookmark: true,
    canDownloadOffline: false,
    canExportNotes: false,
    canManageAccess: false,
  },
};

describe('Bookmark Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBookAccess.mockResolvedValue(null);
    mockParseLocatorRow.mockImplementation((_env, locatorJson) => {
      if (!locatorJson) return Promise.resolve(null);
      try {
        return Promise.resolve(JSON.parse(locatorJson));
      } catch {
        return Promise.resolve(null);
      }
    });
  });

  describe('GET /api/books/:bookId/bookmarks', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAuth.mockResolvedValue(null);
      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks'),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(401);
    });

    it('returns bookmarks when authenticated', async () => {
      mockRequireAuth.mockResolvedValue(authCtx);
      mockQueryAll.mockResolvedValue([
        { id: 'bm-1', book_id: 'book-1', user_email: 'user@example.com', locator_json: '{"cfi":"epubcfi(/6/4)","selectedText":"test","chapterRef":"Ch1"}', label: 'Chapter 1', created_at: '2025-01-01T00:00:00Z' },
      ]);

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks', { headers: { Authorization: 'Bearer valid' } }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(200);
      const body: { data: { id: string; locator: { cfi: string }; label: string }[] } = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('bm-1');
      expect(body.data[0].locator.cfi).toBe('epubcfi(/6/4)');
      expect(body.data[0].label).toBe('Chapter 1');
    });
  });

  describe('POST /api/books/:bookId/bookmarks', () => {
    it('creates bookmark and returns 201', async () => {
      mockRequireAuth.mockResolvedValue(authCtx);
      mockExecute.mockResolvedValue({});

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/8)', selectedText: 'test', chapterRef: 'chapter1.xhtml' }, label: 'My Bookmark' }),
        }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(201);
      const body: { data: { id: string; label: string } } = await res.json();
      expect(body.data.label).toBe('My Bookmark');
      expect(body.data.id).toBeDefined();
    });

    it('returns 403 when canBookmark is false', async () => {
      mockRequireAuth.mockResolvedValue({ ...authCtx, capabilities: { ...authCtx.capabilities, canBookmark: false } });
      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid' },
          body: JSON.stringify({ locator: { cfi: 'epubcfi(/6/8)', selectedText: 'test', chapterRef: 'chapter1.xhtml' } }),
        }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/books/:bookId/bookmarks/:bookmarkId', () => {
    it('deletes bookmark and returns success', async () => {
      mockRequireAuth.mockResolvedValue(authCtx);
      mockExecute.mockResolvedValue({});

      const res = await app.fetch(
        new Request('http://localhost/api/books/book-1/bookmarks/bm-1', {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid' },
        }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(200);
      const body: { ok: boolean } = await res.json();
      expect(body.ok).toBe(true);
    });
  });
});
