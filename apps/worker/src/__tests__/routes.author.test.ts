import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';
import {
  makeEnv,
  makePassThroughContext,
  mockExecute,
  mockQueryFirst,
  mockRequireAdminAuth,
} from './fixtures';
import { app } from '../app';

describe('Author API routes (/api/author/*)', () => {
  let env: Env;
  const authHeaders = { Authorization: 'Bearer admin-token' };

  beforeEach(() => {
    vi.clearAllMocks();
    env = makeEnv();

    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: {
        userId: 'admin-user-1',
        email: 'author@example.com',
        globalRole: 'admin',
        token: 'valid-token',
      },
    });
  });

  describe('Authorization', () => {
    it('returns 401 UNAUTHORIZED when no admin/editor credentials are provided', async () => {
      mockRequireAdminAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        error: 'Invalid session',
      });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript'),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body = await res.json<{ ok: boolean; error: { code: string } }>();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when authenticated user has reader role', async () => {
      mockRequireAdminAuth.mockResolvedValueOnce({
        ok: true,
        context: {
          userId: 'reader-1',
          email: 'reader@example.com',
          globalRole: 'reader',
          token: 'reader-token',
        },
      });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/author/books', () => {
    it('rejects duplicate slugs with 409 Conflict', async () => {
      mockQueryFirst.mockResolvedValueOnce({ id: 'existing-book-id' });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            title: 'My Story',
            slug: 'my-story',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(409);
      const body = await res.json<{ ok: boolean; error: { code: string } }>();
      expect(body.error.code).toBe('CONFLICT');
    });

    it('creates a blank manuscript and inserts into books and draft table', async () => {
      mockQueryFirst.mockResolvedValueOnce(null); // No existing slug
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            title: 'My First Novel',
            slug: 'my-first-novel',
            authorName: 'Mary Shelley',
            template: 'blank',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(201);
      const json = await res.json<{
        ok: boolean;
        data: {
          bookId: string;
          slug: string;
          title: string;
          draftVersion: number;
          publication: { chapters: Array<{ title: string }> };
        };
      }>();
      expect(json.ok).toBe(true);
      expect(json.data.slug).toBe('my-first-novel');
      expect(json.data.title).toBe('My First Novel');
      expect(json.data.draftVersion).toBe(1);
      expect(json.data.publication.chapters).toHaveLength(1);
      expect(json.data.publication.chapters[0]?.title).toBe('Chapter 1');
      expect(mockExecute).toHaveBeenCalledTimes(2); // books row + drafts row
    });

    it('creates novel template with prologue and chapter 1', async () => {
      mockQueryFirst.mockResolvedValueOnce(null);
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            title: 'Sci-Fi Epic',
            slug: 'scifi-epic',
            template: 'novel',
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(201);
      const json = await res.json<{
        ok: boolean;
        data: { publication: { chapters: Array<{ title: string }> } };
      }>();
      expect(json.data.publication.chapters).toHaveLength(2);
      expect(json.data.publication.chapters[0]?.title).toBe('Prologue');
      expect(json.data.publication.chapters[1]?.title).toBe('Chapter 1');
    });
  });

  describe('GET /api/author/books/:id/manuscript', () => {
    it('returns 404 if the book does not exist', async () => {
      mockQueryFirst.mockResolvedValueOnce(null);

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/nonexistent-id/manuscript', {
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(404);
    });

    it('returns existing manuscript draft with publication and version', async () => {
      mockQueryFirst
        .mockResolvedValueOnce({
          id: 'book-1',
          slug: 'book-1-slug',
          title: 'Book One',
        })
        .mockResolvedValueOnce({
          publication_json: JSON.stringify({
            title: 'Book One Edited',
            authorName: 'Ada',
            language: 'en',
            chapters: [
              {
                id: 'ch-1',
                title: 'Introduction',
                order: 0,
                contentHtml: '<p>Content here.</p>',
              },
            ],
          }),
          draft_version: 5,
          updated_at: '2026-11-05T10:00:00Z',
        });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const json = await res.json<{
        ok: boolean;
        data: {
          bookId: string;
          draftVersion: number;
          publication: { title: string; chapters: Array<{ title: string }> };
        };
      }>();
      expect(json.ok).toBe(true);
      expect(json.data.bookId).toBe('book-1');
      expect(json.data.draftVersion).toBe(5);
      expect(json.data.publication.title).toBe('Book One Edited');
    });
  });

  describe('PUT /api/author/books/:id/manuscript', () => {
    it('detects concurrent draft conflicts and returns 409 Conflict', async () => {
      mockQueryFirst.mockResolvedValueOnce({ id: 'book-1' }).mockResolvedValueOnce({
        draft_version: 3,
        publication_json: JSON.stringify({
          title: 'Server Version',
          authorName: 'Server Author',
          language: 'en',
          chapters: [{ id: 'ch-1', title: 'Ch 1', order: 0, contentHtml: '<p>Old</p>' }],
        }),
      });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            expectedVersion: 2, // Out of date! Current is 3
            publication: {
              title: 'Client Version',
              authorName: 'Client Author',
              language: 'en',
              chapters: [{ id: 'ch-1', title: 'Ch 1', order: 0, contentHtml: '<p>New</p>' }],
            },
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(409);
      const json = await res.json<{
        ok: boolean;
        error: { code: string; currentVersion: number };
      }>();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('CONCURRENCY_CONFLICT');
      expect(json.error.currentVersion).toBe(3);
    });

    it('saves draft and increments version when expectedVersion matches', async () => {
      mockQueryFirst.mockResolvedValueOnce({ id: 'book-1' }).mockResolvedValueOnce({
        draft_version: 3,
        publication_json: '{}',
      });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            expectedVersion: 3,
            publication: {
              title: 'Updated Title',
              authorName: 'Ada',
              language: 'en',
              chapters: [{ id: 'ch-1', title: 'Ch 1', order: 0, contentHtml: '<p>Updated</p>' }],
            },
          }),
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const json = await res.json<{
        ok: boolean;
        data: { draftVersion: number; publication: { title: string } };
      }>();
      expect(json.ok).toBe(true);
      expect(json.data.draftVersion).toBe(4);
      expect(json.data.publication.title).toBe('Updated Title');
      expect(mockExecute).toHaveBeenCalledTimes(2); // drafts upsert + books metadata update
    });
  });

  describe('POST /api/author/books/:id/publish', () => {
    it('packages draft, saves to R2, creates book_files revision, and enqueues validation', async () => {
      mockQueryFirst
        .mockResolvedValueOnce({
          id: 'book-1',
          slug: 'my-book',
          title: 'My Book Title',
        })
        .mockResolvedValueOnce({
          draft_version: 2,
          publication_json: JSON.stringify({
            title: 'My Published Book',
            authorName: 'Author Name',
            language: 'en',
            chapters: [
              {
                id: 'ch-1',
                title: 'Chapter 1',
                order: 0,
                contentHtml: '<p>First paragraph of the published book.</p>',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ count: 1 });

      mockExecute.mockResolvedValue({ rows: [] });
      const putSpy = vi.fn().mockResolvedValue(null);
      env.BOOKS_BUCKET.put = putSpy;

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/publish', {
          method: 'POST',
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(201);
      const json = await res.json<{
        ok: boolean;
        data: {
          bookId: string;
          fileId: string;
          revision: number;
          sha256: string;
          fileSize: number;
          status: string;
        };
      }>();
      expect(json.ok).toBe(true);
      expect(json.data.bookId).toBe('book-1');
      expect(json.data.revision).toBe(2);
      expect(json.data.status).toBe('published');
      expect(json.data.sha256).toHaveLength(64);
      expect(json.data.fileSize).toBeGreaterThan(100);

      // Verify file was put into R2 BOOKS_BUCKET
      expect(putSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^books\/book-1\/.*\.epub$/),
        expect.any(Uint8Array),
        expect.objectContaining({
          httpMetadata: expect.objectContaining({
            contentType: 'application/epub+zip',
          }),
        }),
      );
    });
  });
});
