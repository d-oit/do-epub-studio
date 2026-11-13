import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';
import { MAX_AUTHOR_ASSET_COUNT } from '@do-epub-studio/shared';
import {
  makeAuthContext,
  makeEnv,
  makePassThroughContext,
  mockExecute,
  mockQueryAll,
  mockQueryFirst,
  mockRequireAdminAuth,
  mockRequireAuth,
  mockTransaction,
} from './fixtures';
import { app } from '../app';

describe('Author API routes (/api/author/*)', () => {
  let env: Env;
  const authHeaders = { Authorization: 'Bearer admin-token' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryFirst.mockReset();
    mockQueryFirst.mockResolvedValue(null);
    mockRequireAuth.mockReset();
    mockTransaction.mockReset();
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
    it('returns 401 UNAUTHORIZED without valid authoring credentials', async () => {
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

    it('denies a reader without author capability for the requested book', async () => {
      mockRequireAdminAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        error: 'Invalid admin session',
      });
      mockRequireAuth.mockResolvedValueOnce(makeAuthContext({ bookId: 'book-1' }));

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: { Authorization: 'Bearer reader-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(403);
      expect(mockQueryFirst).not.toHaveBeenCalled();
    });

    it('denies an author session scoped to a different book', async () => {
      mockRequireAdminAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        error: 'Invalid admin session',
      });
      const auth = makeAuthContext({ bookId: 'book-2' });
      auth.capabilities.canAuthor = true;
      mockRequireAuth.mockResolvedValueOnce(auth);

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: { Authorization: 'Bearer author-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(403);
      expect(mockQueryFirst).not.toHaveBeenCalled();
    });

    it('allows an author session scoped to the requested book', async () => {
      mockRequireAdminAuth.mockResolvedValueOnce({
        ok: false,
        status: 401,
        error: 'Invalid admin session',
      });
      const auth = makeAuthContext({ bookId: 'book-1' });
      auth.capabilities.canAuthor = true;
      mockRequireAuth.mockResolvedValueOnce(auth);
      mockQueryFirst
        .mockResolvedValueOnce({ id: 'book-1', slug: 'book-1-slug', title: 'Book One' })
        .mockResolvedValueOnce({
          publication_json: JSON.stringify({
            title: 'Book One',
            creators: ['Ada'],
            language: 'en',
            chapters: [
              { id: 'chapter-1', title: 'Chapter 1', order: 0, contentHtml: '<p>Text.</p>' },
            ],
          }),
          draft_version: 1,
          updated_at: '2026-11-08T10:00:00Z',
        });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: { Authorization: 'Bearer author-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
    });

    it('returns 403 for a valid non-admin global session', async () => {
      mockRequireAdminAuth.mockResolvedValueOnce({
        ok: false,
        status: 403,
        error: 'Admin access required',
      });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(403);
      expect(mockRequireAuth).not.toHaveBeenCalled();
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
            creators: ['Ada'],
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
          bookSlug: string;
          draftVersion: number;
          publication: { title: string; chapters: Array<{ title: string }> };
        };
      }>();
      expect(json.data.bookId).toBe('book-1');
      expect(json.data.bookSlug).toBe('book-1-slug');
      expect(json.data.draftVersion).toBe(5);
      expect(json.data.publication.title).toBe('Book One Edited');
    });
    it('initializes a missing draft with insert-if-absent and returns the resolved book slug', async () => {
      mockQueryFirst
        .mockResolvedValueOnce({
          id: 'book-1',
          slug: 'book-1-slug',
          title: 'Book One',
          author_name: 'Ada',
          description: null,
          language: 'en',
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          publication_json: JSON.stringify({
            title: 'Book One',
            creators: ['Ada'],
            language: 'en',
            chapters: [
              { id: 'chapter-1', title: 'Chapter 1', order: 0, contentHtml: '<p>Start.</p>' },
            ],
          }),
          draft_version: 1,
          updated_at: '2026-11-08T10:00:00Z',
        });
      mockExecute.mockResolvedValue({ rows: [] });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const json = await res.json<{
        data: { bookSlug: string; draftVersion: number; publication: { creators: string[] } };
      }>();
      expect(json.data).toMatchObject({
        bookSlug: 'book-1-slug',
        draftVersion: 1,
        publication: { creators: ['Ada'] },
      });
      expect(mockExecute.mock.calls[0]?.[1]).toContain('INSERT OR IGNORE');
    });
  });

  describe('PUT /api/author/books/:id/manuscript', () => {
    it('detects concurrent draft conflicts and returns 409 Conflict', async () => {
      mockTransaction.mockResolvedValueOnce([]);
      mockQueryFirst
        .mockResolvedValueOnce({ id: 'book-1', slug: 'book-1-slug' })
        .mockResolvedValueOnce({
          draft_version: 3,
          publication_json: JSON.stringify({
            title: 'Server Version',
            creators: ['Server Author'],
            language: 'en',
            chapters: [{ id: 'ch-1', title: 'Ch 1', order: 0, contentHtml: '<p>Old</p>' }],
          }),
        });

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            expectedVersion: 2,
            publication: {
              title: 'Client Version',
              creators: ['Client Author'],
              language: 'en',
              chapters: [{ id: 'ch-1', title: 'Ch 1', order: 0, contentHtml: '<p>New</p>' }],
            },
          }),
        }),
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

    it('saves draft and increments version atomically when expectedVersion matches', async () => {
      mockQueryFirst.mockResolvedValueOnce({ id: 'book-1', slug: 'book-1-slug' });
      mockTransaction.mockResolvedValueOnce([
        {
          results: [{ draft_version: 4, updated_at: '2026-11-08T10:00:00Z' }],
        },
        { results: [] },
      ]);

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            expectedVersion: 3,
            publication: {
              title: 'Updated Title',
              creators: ['Ada'],
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
        data: {
          bookSlug: string;
          draftVersion: number;
          publication: { title: string };
        };
      }>();
      expect(json.ok).toBe(true);
      expect(json.data.bookSlug).toBe('book-1-slug');
      expect(json.data.draftVersion).toBe(4);
      expect(json.data.publication.title).toBe('Updated Title');
      expect(mockTransaction).toHaveBeenCalledOnce();
      const statements = mockTransaction.mock.calls[0]?.[1] as Array<{
        sql: string;
        args: unknown[];
      }>;
      expect(statements).toHaveLength(2);
      expect(statements[0]?.sql).toContain('UPDATE book_manuscript_drafts');
      expect(statements[1]?.sql).toContain('UPDATE books');
      expect(statements[1]?.sql).toContain('draft_version = ? AND publication_json = ?');
      expect(statements[1]?.args.slice(5, 8)).toEqual(['book-1', 'book-1', 4]);
      expect(statements[1]?.args[8]).toBe(statements[0]?.args[0]);
      expect(mockExecute).not.toHaveBeenCalled();
    });
    it('rejects a save without an expected draft version', async () => {
      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            publication: {
              title: 'No version',
              creators: ['Ada'],
              language: 'en',
              chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, contentHtml: '<p>Text.</p>' }],
            },
          }),
        }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(400);
      expect(mockQueryFirst).not.toHaveBeenCalled();
    });

    it('rejects an update that references an asset not owned by the book', async () => {
      mockTransaction.mockResolvedValueOnce([]);
      mockQueryFirst
        .mockResolvedValueOnce({ id: 'book-1', slug: 'book-1-slug' })
        .mockResolvedValueOnce({
          draft_version: 3,
          publication_json: JSON.stringify({
            title: 'Current',
            creators: ['Ada'],
            language: 'en',
            chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, contentHtml: '<p>Text.</p>' }],
          }),
        });
      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/manuscript', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            expectedVersion: 3,
            publication: {
              title: 'Missing asset',
              creators: ['Ada'],
              language: 'en',
              chapters: [
                {
                  id: 'ch-1',
                  title: 'Chapter 1',
                  order: 0,
                  contentHtml:
                    '<img src="asset:550e8400-e29b-41d4-a716-446655440000" alt="Diagram">',
                },
              ],
            },
          }),
        }),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(400);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/author/books/:id/publish', () => {
    it('packages draft bytes, creates a content-addressed revision, and enqueues validation', async () => {
      mockQueryFirst
        .mockResolvedValueOnce({
          id: 'book-1',
          slug: 'my-book',
          title: 'My Book Title',
        })
        .mockResolvedValueOnce({
          draft_version: 2,
          updated_at: '2026-11-08 10:00:00',
          publication_json: JSON.stringify({
            title: 'My Published Book',
            creators: ['Author Name'],
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
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'revision-uuid' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ count: 2 });

      const sendValidation = vi.fn().mockResolvedValue(undefined);
      const unexpectedQueueCall = vi.fn(() =>
        Promise.reject(new Error('Unexpected validation queue method')),
      );
      env.EPUB_VALIDATION_QUEUE = {
        send: sendValidation,
        sendBatch: unexpectedQueueCall,
        metrics: unexpectedQueueCall,
      };
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
      expect(sendValidation).toHaveBeenCalledWith({
        bookId: 'book-1',
        revisionId: json.data.fileId,
      });

      // Verify file was put into R2 BOOKS_BUCKET
      expect(putSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^books\/book-1\/author-revisions\/[a-f0-9]{64}\.epub$/),
        expect.any(Uint8Array),
        expect.objectContaining({
          httpMetadata: expect.objectContaining({
            contentType: 'application/epub+zip',
          }),
        }),
      );
      expect(putSpy.mock.calls[0]?.[0]).toBe(
        `books/book-1/author-revisions/${json.data.sha256}.epub`,
      );
    });
    it('rejects manuscripts that reference more than the per-book asset cap', async () => {
      const imageMarkup = Array.from({ length: MAX_AUTHOR_ASSET_COUNT + 1 }, (_, index) => {
        const suffix = index.toString(16).padStart(12, '0');
        return `<img src="asset:00000000-0000-4000-8000-${suffix}" alt="Figure">`;
      }).join('');
      mockQueryFirst
        .mockResolvedValueOnce({ id: 'book-1', slug: 'my-book', title: 'My Book' })
        .mockResolvedValueOnce({
          draft_version: 2,
          updated_at: '2026-11-08T10:00:00Z',
          publication_json: JSON.stringify({
            title: 'My Published Book',
            creators: ['Author Name'],
            language: 'en',
            chapters: [{ id: 'ch-1', title: 'Chapter 1', order: 0, contentHtml: imageMarkup }],
          }),
        });
      const getSpy = vi.fn();
      const putSpy = vi.fn();
      env.BOOKS_BUCKET.get = getSpy;
      env.BOOKS_BUCKET.put = putSpy;

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/publish', {
          method: 'POST',
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(400);
      expect(mockQueryAll).not.toHaveBeenCalled();
      expect(getSpy).not.toHaveBeenCalled();
      expect(putSpy).not.toHaveBeenCalled();
    });

    it('rejects references not owned by the publishing book', async () => {
      const assetId = '550e8400-e29b-41d4-a716-446655440000';
      const publication = {
        title: 'My Published Book',
        creators: ['Author Name'],
        language: 'en',
        chapters: [
          {
            id: 'ch-1',
            title: 'Chapter 1',
            order: 0,
            contentHtml: `<img src="asset:${assetId}" alt="Figure">`,
          },
        ],
      };
      const draft = {
        draft_version: 2,
        updated_at: '2026-11-08T10:00:00Z',
        publication_json: JSON.stringify(publication),
      };
      mockQueryFirst
        .mockResolvedValueOnce({ id: 'book-1', slug: 'my-book', title: 'My Book' })
        .mockResolvedValueOnce(draft);
      mockQueryAll.mockResolvedValueOnce([]);
      const getSpy = vi.fn();
      const putSpy = vi.fn();
      env.BOOKS_BUCKET.get = getSpy;
      env.BOOKS_BUCKET.put = putSpy;

      const missingRes = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/publish', {
          method: 'POST',
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(missingRes.status).toBe(400);
      expect(mockQueryAll.mock.calls[0]?.[1]).toContain(
        'FROM author_assets WHERE book_id = ? AND id IN',
      );
      expect(mockQueryAll.mock.calls[0]?.[2]).toEqual(['book-1', assetId]);
      expect(getSpy).not.toHaveBeenCalled();
      expect(putSpy).not.toHaveBeenCalled();
    });

    it('rejects corrupted stored asset bytes before publishing', async () => {
      const assetId = '550e8400-e29b-41d4-a716-446655440000';
      const publication = {
        title: 'My Published Book',
        creators: ['Author Name'],
        language: 'en',
        chapters: [
          {
            id: 'ch-1',
            title: 'Chapter 1',
            order: 0,
            contentHtml: `<img src="asset:${assetId}" alt="Figure">`,
          },
        ],
      };
      mockQueryFirst
        .mockResolvedValueOnce({ id: 'book-1', slug: 'my-book', title: 'My Book' })
        .mockResolvedValueOnce({
          draft_version: 2,
          updated_at: '2026-11-08T10:00:00Z',
          publication_json: JSON.stringify(publication),
        });
      mockQueryAll.mockResolvedValueOnce([
        {
          id: assetId,
          media_type: 'image/png',
          sha256: '0'.repeat(64),
          size_bytes: 3,
          storage_key: 'books/book-1/author-assets/asset-id/hash',
        },
      ]);
      const bytes = new Uint8Array([1, 2, 3]);
      const getSpy = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(bytes.buffer),
      });
      const putSpy = vi.fn();
      env.BOOKS_BUCKET.get = getSpy;
      env.BOOKS_BUCKET.put = putSpy;

      const res = await app.fetch(
        new Request('http://localhost/api/author/books/book-1/publish', {
          method: 'POST',
          headers: authHeaders,
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(409);
      expect(getSpy).toHaveBeenCalledWith('books/book-1/author-assets/asset-id/hash');
      expect(putSpy).not.toHaveBeenCalled();
    });
  });
});
