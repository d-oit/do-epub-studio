import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryAll,
} from './fixtures';
import { app } from '../app';

describe('Catalog Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/catalog', () => {
    it('returns public books without authentication', async () => {
      const mockBooks = [
        {
          id: 'book-1',
          slug: 'public-book-1',
          title: 'Public Book 1',
          author_name: 'Author 1',
          description: 'Description 1',
          language: 'en',
          cover_image_url: 'https://example.com/cover1.jpg',
          published_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'book-2',
          slug: 'public-book-2',
          title: 'Public Book 2',
          author_name: null,
          description: null,
          language: 'fr',
          cover_image_url: null,
          published_at: null,
        },
      ];

      mockQueryAll.mockResolvedValue(mockBooks);

      const res = await app.fetch(
        new Request('http://localhost/api/catalog'),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
      const body = (await res.json()) as unknown as { ok: boolean; data: Array<Record<string, unknown>> };

      expect(body.ok).toBe(true);
      expect(body.data).toHaveLength(2);

      // Verify mapping for full data
      expect(body.data[0]).toEqual({
        id: 'book-1',
        slug: 'public-book-1',
        title: 'Public Book 1',
        authorName: 'Author 1',
        description: 'Description 1',
        language: 'en',
        coverImageUrl: 'https://example.com/cover1.jpg',
        publishedAt: '2024-01-01T00:00:00Z',
      });

      // Verify mapping for null data
      expect(body.data[1]).toEqual({
        id: 'book-2',
        slug: 'public-book-2',
        title: 'Public Book 2',
        authorName: null,
        description: null,
        language: 'fr',
        coverImageUrl: null,
        publishedAt: null,
      });

      // Verify the SQL query
      expect(mockQueryAll).toHaveBeenCalledWith(
        env,
        expect.stringContaining("WHERE visibility = 'public'"),
        [],
      );
      expect(mockQueryAll).toHaveBeenCalledWith(
        env,
        expect.stringContaining("AND archived_at IS NULL"),
        [],
      );
    });

    it('returns an empty list when no public books exist', async () => {
      mockQueryAll.mockResolvedValue([]);

      const res = await app.fetch(
        new Request('http://localhost/api/catalog'),
        env,
        makePassThroughContext() as unknown as ExecutionContext,
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
      const body = (await res.json()) as unknown as { ok: boolean; data: unknown[] };
      expect(body.ok).toBe(true);
      expect(body.data).toEqual([]);
    });
  });
});
