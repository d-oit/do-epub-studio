import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeRequest,
  makeAuthContext,
  makeBookRow,
  mockQueryFirst,
  mockQueryAll,
  mockRequireAuth,
} from './fixtures';
import { handleListBooks, handleGetBook, handleGetFileUrl } from '../routes/books';

describe('GET /api/books (handleListBooks)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const env = makeEnv();
    const req = makeRequest();
    const res = await handleListBooks(env, req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns list of books for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([makeBookRow()] as never);

    const env = makeEnv();
    const req = makeRequest();
    const res = await handleListBooks(env, req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe('test-book');
  });
});

describe('GET /api/books/{slug} (handleGetBook)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleGetBook(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(401);
  });

  it('returns 404 when book not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null as never);

    const res = await handleGetBook(makeEnv(), makeRequest(), 'nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not have access to book', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'other-book' }));
    mockQueryFirst.mockResolvedValue(makeBookRow({ id: 'book-1' }) as never);

    const res = await handleGetBook(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(403);
  });

  it('returns book details when access is granted', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    mockQueryFirst.mockResolvedValue(makeBookRow() as never);

    const res = await handleGetBook(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('Test Book');
  });
});

describe('POST /api/books/{slug}/file-url (handleGetFileUrl)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot read', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({
        capabilities: {
          canRead: false,
          canComment: false,
          canHighlight: false,
          canBookmark: false,
          canDownloadOffline: false,
          canExportNotes: false,
          canManageAccess: false,
        },
      }),
    );

    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(403);
  });

  it('returns 404 when book not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null as never);

    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 when book file not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    mockQueryFirst.mockResolvedValueOnce({ id: 'book-1', slug: 'test-book' } as never);
    mockQueryFirst.mockResolvedValueOnce(null as never);

    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(404);
  });

  it('returns signed URL when book and file exist', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    mockQueryFirst.mockResolvedValueOnce({ id: 'book-1', slug: 'test-book' } as never);
    mockQueryFirst.mockResolvedValueOnce({
      id: 'file-1',
      book_id: 'book-1',
      storage_key: 'books/book-1/file.epub',
    } as never);

    const { mockGenerateSignedUrl } = await import('./fixtures');
    mockGenerateSignedUrl.mockResolvedValue({
      url: 'https://test.example.com/api/files/book-1/books/book-1/epub/file.epub?expires=123&signature=abc',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      fileSize: 102400,
      mimeType: 'application/epub+zip',
    });

    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.url).toContain('https://test.example.com/api/files/');
  });
});
