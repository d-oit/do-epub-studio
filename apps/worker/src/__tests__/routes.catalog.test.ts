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

      mockQueryAll.mockResolvedValueOnce([{ cnt: 2 }]).mockResolvedValueOnce(mockBooks);

      const res = await app.fetch(
        new Request('http://localhost/api/catalog'),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
      const body = (await res.json()) as unknown as {
        ok: boolean;
        data: {
          items: Array<Record<string, unknown>>;
          total: number;
          page: number;
          pageSize: number;
          hasMore: boolean;
        };
      };

      expect(body.ok).toBe(true);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.total).toBe(2);
      expect(body.data.page).toBe(1);
      expect(body.data.pageSize).toBe(24);
      expect(body.data.hasMore).toBe(false);

      // Verify mapping for full data
      expect(body.data.items[0]).toEqual({
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
      expect(body.data.items[1]).toEqual({
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

    it('accepts q/author/language query filters', async () => {
      mockQueryAll.mockResolvedValueOnce([{ cnt: 1 }]).mockResolvedValueOnce([
        {
          id: 'book-1',
          slug: 'orwell-1984',
          title: '1984',
          author_name: 'George Orwell',
          description: null,
          language: 'en',
          cover_image_url: null,
          published_at: '2024-01-01T00:00:00Z',
        },
      ]);

      const res = await app.fetch(
        new Request('http://localhost/api/catalog?q=orwell&author=Orwell&language=en&limit=10&offset=0'),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
      const body = (await res.json()) as unknown as {
        ok: boolean;
        data: { items: Array<Record<string, unknown>>; total: number; pageSize: number };
      };
      expect(body.ok).toBe(true);
      expect(body.data.total).toBe(1);
      expect(body.data.pageSize).toBe(10);
      expect(body.data.items[0]?.slug).toBe('orwell-1984');

      expect(mockQueryAll).toHaveBeenCalledWith(
        env,
        expect.stringContaining('title LIKE ?'),
        expect.arrayContaining(['%orwell%']),
      );
    });

    it('rejects limit > 100', async () => {
      const res = await app.fetch(
        new Request('http://localhost/api/catalog?limit=200'),
        env,
        makePassThroughContext(),
      );
      expect(res.status).toBe(400);
    });

    it('returns an empty list when no public books exist', async () => {
      mockQueryAll.mockResolvedValueOnce([{ cnt: 0 }]).mockResolvedValueOnce([]);

      const res = await app.fetch(
        new Request('http://localhost/api/catalog'),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- Hono Response.json() returns unknown
      const body = (await res.json()) as unknown as {
        ok: boolean;
        data: { items: unknown[]; total: number; hasMore: boolean };
      };
      expect(body.ok).toBe(true);
      expect(body.data.items).toEqual([]);
      expect(body.data.total).toBe(0);
      expect(body.data.hasMore).toBe(false);
    });
  });
});
