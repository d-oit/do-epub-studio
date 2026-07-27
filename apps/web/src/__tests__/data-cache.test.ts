import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchCatalogBooks,
  invalidateCatalogCache,
  fetchAuditLogs,
  invalidateAuditLogCache,
  fetchAdminBooks,
  fetchGrantsForBook,
  invalidateGrantsCache,
  _resetAllCaches,
} from '../lib/data-cache';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockApiRequest = vi.fn();

vi.mock('../lib/api', () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('data-cache — catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCatalogCache();
  });

  it('fetchCatalogBooks returns cached result on second call', async () => {
    const books = [{ id: '1', slug: 'a', title: 'Book A', authorName: null, description: null, language: 'en', coverImageUrl: null, publishedAt: null }];
    mockApiRequest.mockResolvedValueOnce(books);

    const first = await fetchCatalogBooks();
    const second = await fetchCatalogBooks();

    expect(first).toEqual(books);
    expect(second).toEqual(books);
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('invalidateCatalogCache clears cache', async () => {
    const books = [{ id: '1', slug: 'a', title: 'Book A', authorName: null, description: null, language: 'en', coverImageUrl: null, publishedAt: null }];
    mockApiRequest.mockResolvedValue(books);

    await fetchCatalogBooks();
    invalidateCatalogCache();
    await fetchCatalogBooks();

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });
});

describe('data-cache — audit logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateAuditLogCache();
  });

  it('fetchAuditLogs builds correct query params', async () => {
    const response = { entries: [], total: 0 };
    mockApiRequest.mockResolvedValueOnce(response);

    const filters = { page: 1, entityType: 'book', entityId: 'b1', dateFrom: '2026-01-01', dateTo: '2026-12-31', pageSize: 10 };
    await fetchAuditLogs(filters, 'token-1');

    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/audit?'),
      expect.objectContaining({ token: 'token-1' }),
    );
  });

  it('fetchAuditLogs omits empty filters from query', async () => {
    mockApiRequest.mockResolvedValueOnce({ entries: [], total: 0 });

    const filters = { page: 1, entityType: '', entityId: '', dateFrom: '', dateTo: '', pageSize: 25 };
    await fetchAuditLogs(filters, null);

    const url = mockApiRequest.mock.calls[0][0] as string;
    expect(url).not.toContain('entityType=');
    expect(url).not.toContain('entityId=');
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('fetchAuditLogs caches by filter key', async () => {
    mockApiRequest.mockResolvedValue({ entries: [], total: 0 });

    const filters = { page: 1, entityType: '', entityId: '', dateFrom: '', dateTo: '', pageSize: 10 };
    await fetchAuditLogs(filters, 'tok');
    await fetchAuditLogs(filters, 'tok');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('invalidateAuditLogCache clears cache', async () => {
    mockApiRequest.mockResolvedValue({ entries: [], total: 0 });

    const filters = { page: 1, entityType: '', entityId: '', dateFrom: '', dateTo: '', pageSize: 10 };
    await fetchAuditLogs(filters, 'tok');
    invalidateAuditLogCache();
    await fetchAuditLogs(filters, 'tok');

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });
});

describe('data-cache — admin books', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchAdminBooks maps response to BookOption', async () => {
    const books = [{ id: '1', slug: 'a', title: 'Book A', authorName: null, description: null, language: 'en', visibility: 'private', coverImageUrl: null, publishedAt: null }];
    mockApiRequest.mockResolvedValueOnce(books);

    const result = await fetchAdminBooks('admin-token');

    expect(result).toEqual([{ id: '1', title: 'Book A', slug: 'a' }]);
  });

  it('fetchAdminBooks caches by token', async () => {
    mockApiRequest.mockResolvedValue([{ id: '1', slug: 'a', title: 'A', authorName: null, description: null, language: 'en', visibility: 'private', coverImageUrl: null, publishedAt: null }]);

    await fetchAdminBooks('tok');
    await fetchAdminBooks('tok');

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });
});

describe('data-cache — grants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchGrantsForBook returns grants', async () => {
    const grants = [{ id: 'g1', email: 'a@b.com', mode: 'reader_only', commentsAllowed: false, offlineAllowed: false, expiresAt: null, createdAt: 'now', revokedAt: null }];
    mockApiRequest.mockResolvedValueOnce(grants);

    const result = await fetchGrantsForBook('book-1', 'admin-token');

    expect(result).toEqual(grants);
    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/admin/books/book-1/grants',
      { token: 'admin-token' },
    );
  });

  it('invalidateGrantsCache clears specific book grants', async () => {
    const grants = [{ id: 'g1', email: 'a@b.com', mode: 'reader_only', commentsAllowed: false, offlineAllowed: false, expiresAt: null, createdAt: 'now', revokedAt: null }];
    mockApiRequest.mockResolvedValue(grants);

    await fetchGrantsForBook('book-1', 'tok');
    invalidateGrantsCache('book-1');
    await fetchGrantsForBook('book-1', 'tok');

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });

  it('invalidateGrantsCache with no arg clears all', async () => {
    mockApiRequest.mockResolvedValue([]);

    await fetchGrantsForBook('book-1', 'tok');
    await fetchGrantsForBook('book-2', 'tok');
    invalidateGrantsCache();
    await fetchGrantsForBook('book-1', 'tok');

    expect(mockApiRequest).toHaveBeenCalledTimes(3);
  });
});

describe('data-cache — _resetAllCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAllCaches();
  });

  it('clears all caches at once', async () => {
    mockApiRequest.mockResolvedValue([]);

    await fetchCatalogBooks();
    await fetchAuditLogs({ page: 1, entityType: '', entityId: '', dateFrom: '', dateTo: '', pageSize: 10 }, 'tok');
    _resetAllCaches();
    await fetchCatalogBooks();

    expect(mockApiRequest).toHaveBeenCalledTimes(3);
  });
});

describe('data-cache — error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAllCaches();
  });

  it('fetchCatalogBooks propagates rejection', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network error'));

    await expect(fetchCatalogBooks()).rejects.toThrow('network error');
  });

  it('fetchCatalogBooks caches rejected promise (known limitation)', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('fail'));

    await expect(fetchCatalogBooks()).rejects.toThrow('fail');
    // Second call returns the same cached rejected promise
    await expect(fetchCatalogBooks()).rejects.toThrow('fail');
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it('fetchAuditLogs propagates rejection', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('unauthorized'));

    await expect(
      fetchAuditLogs({ page: 1, entityType: '', entityId: '', dateFrom: '', dateTo: '', pageSize: 10 }, 'tok'),
    ).rejects.toThrow('unauthorized');
  });

  it('fetchAdminBooks propagates rejection', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('forbidden'));

    await expect(fetchAdminBooks('tok')).rejects.toThrow('forbidden');
  });

  it('fetchGrantsForBook propagates rejection', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('server error'));

    await expect(fetchGrantsForBook('book-1', 'tok')).rejects.toThrow('server error');
  });

  it('invalidation clears rejected cache entry', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('transient'));
    await expect(fetchCatalogBooks()).rejects.toThrow('transient');

    invalidateCatalogCache();
    mockApiRequest.mockResolvedValueOnce([{ id: '2', slug: 'b', title: 'B', authorName: null, description: null, language: 'en', coverImageUrl: null, publishedAt: null }]);
    const result = await fetchCatalogBooks();

    expect(result).toHaveLength(1);
    expect(mockApiRequest).toHaveBeenCalledTimes(2);
  });
});
