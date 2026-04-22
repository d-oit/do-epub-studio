import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock all Worker modules BEFORE importing route handlers
// ---------------------------------------------------------------------------

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn(),
  validateSession: vi.fn(),
  generateToken: vi.fn(),
}));

vi.mock('../auth/password', () => ({
  validateGrant: vi.fn(),
  computeCapabilities: vi.fn(),
  getGrantByBookAndSession: vi.fn(),
  getGrantsBySession: vi.fn(),
  createGrant: vi.fn(),
}));

vi.mock('../auth/session', () => ({
  createSession: vi.fn(),
  validateSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('../storage/signed-url', () => ({
  generateSignedUrl: vi.fn(),
  verifySignedUrlExpiry: vi.fn(),
  verifySignedUrlSignature: vi.fn(),
}));

vi.mock('../audit', () => ({
  logAudit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocking
// ---------------------------------------------------------------------------

import { queryFirst, queryAll, execute } from '../db/client';
import { requireAuth } from '../auth/middleware';
import { validateGrant, computeCapabilities, createGrant as createGrantMod } from '../auth/password';
import { createSession, validateSession as validateSessionMod, revokeSession } from '../auth/session';
import { generateSignedUrl, verifySignedUrlExpiry, verifySignedUrlSignature } from '../storage/signed-url';
import { logAudit } from '../audit';

import type { Env } from '../lib/env';
import type { AuthContext } from '../auth/middleware';
import { handleListBooks, handleGetBook, handleGetFileUrl } from '../routes/books';
import { handleAccessRequest, handleLogout, handleRefresh, handleValidatePermission, handleValidateAllPermissions } from '../routes/access';
import {
  handleGetProgress,
  handleUpdateProgress,
  handleListBookmarks,
  handleCreateBookmark,
  handleDeleteBookmark,
  handleListHighlights,
  handleCreateHighlight,
  handleDeleteHighlight,
  handleUpdateHighlight,
} from '../routes/reader-state';
import { handleListComments, handleCreateComment, handleUpdateComment } from '../routes/comments';
import { handleDownloadBookFile } from '../routes/files';
import {
  handleCreateBook,
  handleUploadComplete,
  handleCreateAdminGrant,
  handleUpdateGrant,
  handleRevokeGrant,
  handleGetBookGrants,
  handleGetAuditLog,
} from '../routes/admin';

const mockQueryFirst = vi.mocked(queryFirst);
const mockQueryAll = vi.mocked(queryAll);
const mockExecute = vi.mocked(execute);
const mockRequireAuth = vi.mocked(requireAuth);
const mockValidateGrant = vi.mocked(validateGrant);
const mockComputeCapabilities = vi.mocked(computeCapabilities);
const mockCreateGrant = vi.mocked(createGrantMod);
const mockCreateSession = vi.mocked(createSession);
const mockValidateSessionMod = vi.mocked(validateSessionMod);
const mockRevokeSession = vi.mocked(revokeSession);
const mockGenerateSignedUrl = vi.mocked(generateSignedUrl);
const mockVerifyExpiry = vi.mocked(verifySignedUrlExpiry);
const mockVerifySignature = vi.mocked(verifySignedUrlSignature);
const mockLogAudit = vi.mocked(logAudit);

// ---------------------------------------------------------------------------
// Test helpers / factories
// ---------------------------------------------------------------------------

function makeEnv(): Env {
  return {
    BOOKS_BUCKET: makeMockBucket(),
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    SESSION_SIGNING_SECRET: 'test-secret',
    INVITE_TOKEN_SECRET: 'test-invite-secret',
    APP_BASE_URL: 'https://test.example.com',
  };
}

function makeMockBucket() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({ key: 'test' }),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false }),
  } as unknown as Env['BOOKS_BUCKET'];
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.example.com/api/test', {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    sessionId: 'session-1',
    bookId: 'book-1',
    email: 'reader@example.com',
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: false,
      canExportNotes: true,
      canManageAccess: false,
    },
    ...overrides,
  };
}

function makeBookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'book-1',
    slug: 'test-book',
    title: 'Test Book',
    author_name: 'Test Author',
    description: 'A test book',
    language: 'en',
    visibility: 'private',
    cover_image_url: null,
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: null,
    ...overrides,
  };
}

function makeGrantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grant-1',
    book_id: 'book-1',
    email: 'reader@example.com',
    mode: 'private',
    allowed: 1,
    comments_allowed: 1,
    offline_allowed: 0,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revoked_at: null,
    ...overrides,
  };
}

function makeSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    book_id: 'book-1',
    email: 'reader@example.com',
    session_token_hash: 'hashed-token',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    revoked_at: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks();
  mockLogAudit.mockResolvedValue(undefined);
  mockExecute.mockResolvedValue({ changes: 0, lastInsertRowid: 0n } as never);
});

// ===========================================================================
// BOOK ROUTES
// ===========================================================================

describe('GET /api/books (handleListBooks)', () => {
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
    const auth = makeAuthContext();
    mockRequireAuth.mockResolvedValue(auth);
    mockQueryAll.mockResolvedValue([
      makeBookRow({ id: 'book-1', slug: 'book-one', title: 'Book One' }),
      makeBookRow({ id: 'book-2', slug: 'book-two', title: 'Book Two' }),
    ] as never);

    const env = makeEnv();
    const req = makeRequest();
    const res = await handleListBooks(env, req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].slug).toBe('book-one');
    expect(mockQueryAll).toHaveBeenCalledOnce();
  });

  it('returns empty array when no books found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListBooks(makeEnv(), makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe('GET /api/books/{slug} (handleGetBook)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleGetBook(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(401);
  });

  it('returns 404 when book not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null);

    const res = await handleGetBook(makeEnv(), makeRequest(), 'nonexistent');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when book id does not match session bookId', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'other-book' }));
    mockQueryFirst.mockResolvedValue(makeBookRow({ id: 'book-1' }));

    const res = await handleGetBook(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns book data when authenticated and book matches', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    mockQueryFirst.mockResolvedValue(makeBookRow());

    const res = await handleGetBook(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.title).toBe('Test Book');
    expect(body.data.slug).toBe('test-book');
    expect(body.data.authorName).toBe('Test Author');
  });
});

describe('POST /api/books/{slug}/file-url (handleGetFileUrl)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot read', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({ capabilities: { canRead: false, canComment: false, canHighlight: false, canBookmark: false, canDownloadOffline: false, canExportNotes: false, canManageAccess: false } }),
    );
    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(403);
  });

  it('returns 404 when book not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst
      .mockResolvedValueOnce(null) // book lookup
      .mockResolvedValueOnce(null); // file lookup

    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 when no file found for book', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    mockQueryFirst
      .mockResolvedValueOnce({ id: 'book-1', slug: 'test-book' })
      .mockResolvedValueOnce(null);

    const res = await handleGetFileUrl(makeEnv(), makeRequest(), 'test-book');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns signed URL when book and file exist', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ bookId: 'book-1' }));
    
    const bookRow = { id: 'book-1', slug: 'test-book' };
    const fileRow = {
      id: 'file-1',
      book_id: 'book-1',
      storage_key: 'books/book-1/epub/file.epub',
      original_filename: 'file.epub',
      mime_type: 'application/epub+zip',
      file_size_bytes: 102400,
    };
    
    mockQueryFirst.mockImplementation(async (_env: unknown, _sql: string) => {
      if (_sql.includes('FROM books WHERE')) return bookRow;
      if (_sql.includes('FROM book_files')) return fileRow;
      return null;
    });

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
    expect(mockGenerateSignedUrl).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// ACCESS ROUTES
// ===========================================================================

describe('POST /api/access/request (handleAccessRequest)', () => {
  const validPayload = { bookSlug: 'test-book', email: 'reader@example.com', password: 'secret123' };

  it('returns validation error for missing fields', async () => {
    const res = await handleAccessRequest(makeEnv(), {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when grant validation fails', async () => {
    mockValidateGrant.mockResolvedValue({ valid: false, error: 'invalid_password' });

    const res = await handleAccessRequest(makeEnv(), validPayload);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('ACCESS_DENIED');
  });

  it('returns session token and book data on successful access', async () => {
    const grant = makeGrantRow();
    const book = makeBookRow();
    mockValidateGrant.mockResolvedValue({ valid: true, grant, book } as never);
    mockCreateSession.mockResolvedValue('session-token-abc');
    mockComputeCapabilities.mockReturnValue({
      canRead: true,
      canComment: false,
      canHighlight: false,
      canBookmark: true,
      canDownloadOffline: false,
      canExportNotes: false,
      canManageAccess: false,
    });

    const res = await handleAccessRequest(makeEnv(), validPayload);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionToken).toBe('session-token-abc');
    expect(body.data.book.title).toBe('Test Book');
    expect(body.data.capabilities.canRead).toBe(true);
    expect(mockCreateSession).toHaveBeenCalledWith(expect.anything(), 'book-1', 'reader@example.com');
  });

  it('normalizes email to lowercase', async () => {
    const grant = makeGrantRow();
    const book = makeBookRow();
    mockValidateGrant.mockResolvedValue({ valid: true, grant, book } as never);
    mockCreateSession.mockResolvedValue('token');
    mockComputeCapabilities.mockReturnValue({ canRead: true, canComment: false, canHighlight: false, canBookmark: true, canDownloadOffline: false, canExportNotes: false, canManageAccess: false });

    await handleAccessRequest(makeEnv(), { bookSlug: 'test-book', email: 'READER@EXAMPLE.COM' });
    expect(mockValidateGrant).toHaveBeenCalledWith(
      expect.anything(),
      'test-book',
      'reader@example.com',
      undefined,
    );
  });
});

describe('POST /api/access/logout (handleLogout)', () => {
  it('revokes session and returns ok', async () => {
    mockRevokeSession.mockResolvedValue(undefined);
    const res = await handleLogout(makeEnv(), 'session-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/access/refresh (handleRefresh)', () => {
  it('returns 401 for invalid session', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false });
    const res = await handleRefresh(makeEnv(), 'bad-token');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('SESSION_INVALID');
  });

  it('returns new session token for valid session', async () => {
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow(),
      bookId: 'book-1',
    });
    mockCreateSession.mockResolvedValue('new-token');

    const res = await handleRefresh(makeEnv(), 'valid-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.sessionToken).toBe('new-token');
  });
});

describe('GET /api/access/validate-permission (handleValidatePermission)', () => {
  it('returns 401 for invalid session', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false });
    const res = await handleValidatePermission(makeEnv(), 'book-1', 'bad-token');
    expect(res.status).toBe(401);
  });

  it('returns invalid grant when grant is revoked', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: true, session: makeSessionRow(), bookId: 'book-1' });
    const { getGrantByBookAndSession } = await import('../auth/password');
    vi.mocked(getGrantByBookAndSession).mockResolvedValue({ revoked_at: new Date().toISOString() } as never);

    const res = await handleValidatePermission(makeEnv(), 'book-1', 'token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.valid).toBe(false);
  });

  it('returns grant capabilities when valid', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: true, session: makeSessionRow(), bookId: 'book-1' });
    const { getGrantByBookAndSession } = await import('../auth/password');
    vi.mocked(getGrantByBookAndSession).mockResolvedValue(makeGrantRow({ comments_allowed: 1, offline_allowed: 1 }) as never);

    const res = await handleValidatePermission(makeEnv(), 'book-1', 'token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.valid).toBe(true);
    expect(body.data.canComment).toBe(true);
    expect(body.data.canDownloadOffline).toBe(true);
  });
});

describe('GET /api/access/validate-all-permissions (handleValidateAllPermissions)', () => {
  it('returns 401 for invalid session', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false });
    const res = await handleValidateAllPermissions(makeEnv(), 'bad-token');
    expect(res.status).toBe(401);
  });

  it('returns valid grant IDs and revoked book IDs', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: true, session: makeSessionRow(), bookId: 'book-1' });
    const { getGrantsBySession } = await import('../auth/password');
    vi.mocked(getGrantsBySession).mockResolvedValue([
      makeGrantRow({ id: 'grant-1', revoked_at: null }),
      makeGrantRow({ id: 'grant-2', book_id: 'revoked-book', revoked_at: new Date().toISOString() }),
    ] as never);

    const res = await handleValidateAllPermissions(makeEnv(), 'token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.grantIds).toEqual(['grant-1']);
    expect(body.data.revokedBookIds).toEqual(['revoked-book']);
  });
});

// ===========================================================================
// READER STATE: PROGRESS
// ===========================================================================

describe('GET /api/reader-state/{bookId}/progress (handleGetProgress)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleGetProgress(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns null progress when no record exists', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockReturnValue(Promise.resolve(null));

    const res = await handleGetProgress(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.locator).toBeNull();
    expect(body.data.progressPercent).toBe(0);
  });

  it('returns saved progress when record exists', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const progressRow = {
      id: 'progress-1',
      book_id: 'book-1',
      user_email: 'reader@example.com',
      locator_json: JSON.stringify({ cfi: 'epubcfi(/6/4)' }),
      progress_percent: 45.5,
      updated_at: new Date().toISOString(),
    };
    mockQueryFirst.mockReturnValue(Promise.resolve(progressRow));

    const res = await handleGetProgress(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.locator.cfi).toBe('epubcfi(/6/4)');
    expect(body.data.progressPercent).toBe(45.5);
  });
});

describe('POST /api/reader-state/{bookId}/progress (handleUpdateProgress)', () => {
  const validBody = {
    locator: { cfi: 'epubcfi(/6/4)', selectedText: 'test' },
    progressPercent: 50,
  };

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot read', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({ capabilities: { canRead: false, canComment: false, canHighlight: false, canBookmark: false, canDownloadOffline: false, canExportNotes: false, canManageAccess: false } }),
    );
    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', { locator: {}, progressPercent: -1 });
    expect(res.status).toBe(400);
  });

  it('saves progress and returns updated data', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await handleUpdateProgress(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.progressPercent).toBe(50);
    expect(mockExecute).toHaveBeenCalled();
  });
});

// ===========================================================================
// READER STATE: BOOKMARKS
// ===========================================================================

describe('GET /api/reader-state/{bookId}/bookmarks (handleListBookmarks)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleListBookmarks(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no bookmarks exist', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListBookmarks(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('returns list of bookmarks', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([{
      id: 'bm-1',
      book_id: 'book-1',
      user_email: 'reader@example.com',
      locator_json: JSON.stringify({ cfi: 'epubcfi(/6/4)' }),
      label: 'Chapter 1',
      created_at: new Date().toISOString(),
    }] as never);

    const res = await handleListBookmarks(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].label).toBe('Chapter 1');
  });
});

describe('POST /api/reader-state/{bookId}/bookmarks (handleCreateBookmark)', () => {
  const validBody = {
    locator: { cfi: 'epubcfi(/6/4)', selectedText: 'text' },
    label: 'My Bookmark',
  };

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot bookmark', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({ capabilities: { canRead: true, canComment: false, canHighlight: false, canBookmark: false, canDownloadOffline: false, canExportNotes: false, canManageAccess: false } }),
    );
    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', { locator: {} });
    expect(res.status).toBe(400);
  });

  it('creates bookmark and returns data', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await handleCreateBookmark(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.label).toBe('My Bookmark');
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('DELETE /api/reader-state/{bookId}/bookmarks/{bookmarkId} (handleDeleteBookmark)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleDeleteBookmark(makeEnv(), makeRequest(), 'book-1', 'bm-1');
    expect(res.status).toBe(401);
  });

  it('deletes bookmark and returns ok', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await handleDeleteBookmark(makeEnv(), makeRequest(), 'book-1', 'bm-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('DELETE FROM bookmarks'),
      ['bm-1', 'book-1', 'reader@example.com'],
    );
  });
});

// ===========================================================================
// READER STATE: HIGHLIGHTS
// ===========================================================================

describe('GET /api/reader-state/{bookId}/highlights (handleListHighlights)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleListHighlights(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListHighlights(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('returns list of highlights', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([{
      id: 'hl-1',
      book_id: 'book-1',
      user_email: 'reader@example.com',
      chapter_ref: 'Chapter 1',
      cfi_range: 'epubcfi(/6/4)',
      selected_text: 'Highlighted text',
      note: null,
      color: '#ffff00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }] as never);

    const res = await handleListHighlights(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].selectedText).toBe('Highlighted text');
  });
});

describe('POST /api/reader-state/{bookId}/highlights (handleCreateHighlight)', () => {
  const validBody = {
    selectedText: 'Important passage',
    cfiRange: 'epubcfi(/6/4)',
    chapterRef: 'Chapter 1',
    color: '#00ff00',
    note: 'My note',
  };

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot highlight', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({ capabilities: { canRead: true, canComment: false, canHighlight: false, canBookmark: true, canDownloadOffline: false, canExportNotes: false, canManageAccess: false } }),
    );
    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('returns 400 for missing selectedText', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', { selectedText: '' });
    expect(res.status).toBe(400);
  });

  it('creates highlight and returns data', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await handleCreateHighlight(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.selectedText).toBe('Important passage');
    expect(body.data.color).toBe('#00ff00');
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('DELETE /api/reader-state/{bookId}/highlights/{highlightId} (handleDeleteHighlight)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleDeleteHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1');
    expect(res.status).toBe(401);
  });

  it('deletes highlight and returns ok', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await handleDeleteHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('DELETE FROM highlights'),
      ['hl-1', 'book-1', 'reader@example.com'],
    );
  });
});

describe('PATCH /api/reader-state/{bookId}/highlights/{highlightId} (handleUpdateHighlight)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when highlight not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null);

    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when trying to edit another user\'s highlight', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ email: 'other@example.com' }));
    mockQueryFirst.mockResolvedValue({
      id: 'hl-1',
      book_id: 'book-1',
      user_email: 'reader@example.com',
      selected_text: 'text',
      note: null,
      color: '#ffff00',
      chapter_ref: null,
      cfi_range: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated' });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('updates highlight note and color', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue({
      id: 'hl-1',
      book_id: 'book-1',
      user_email: 'reader@example.com',
      selected_text: 'text',
      note: null,
      color: '#ffff00',
      chapter_ref: null,
      cfi_range: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const res = await handleUpdateHighlight(makeEnv(), makeRequest(), 'book-1', 'hl-1', { note: 'updated note', color: '#ff0000' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('hl-1');
  });
});

// ===========================================================================
// COMMENTS
// ===========================================================================

describe('GET /api/comments/{bookId} (handleListComments)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleListComments(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(401);
  });

  it('returns empty threaded comments', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleListComments(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('returns threaded comment tree with replies nested', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const parentId = crypto.randomUUID();
    mockQueryAll.mockResolvedValue([
      {
        id: parentId,
        book_id: 'book-1',
        user_email: 'reader@example.com',
        chapter_ref: 'Chapter 1',
        cfi_range: null,
        selected_text: null,
        body: 'Root comment',
        status: 'open',
        visibility: 'shared',
        parent_comment_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: null,
      },
      {
        id: 'reply-1',
        book_id: 'book-1',
        user_email: 'reader@example.com',
        chapter_ref: null,
        cfi_range: null,
        selected_text: null,
        body: 'Reply to root',
        status: 'open',
        visibility: 'shared',
        parent_comment_id: parentId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: null,
      },
    ] as never);

    const res = await handleListComments(makeEnv(), makeRequest(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].replies).toHaveLength(1);
    expect(body.data[0].body).toBe('Root comment');
  });
});

describe('POST /api/comments/{bookId} (handleCreateComment)', () => {
  const validBody = {
    body: 'This is a comment',
    chapterRef: 'Chapter 1',
    cfiRange: 'epubcfi(/6/4)',
    visibility: 'shared' as const,
  };

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot comment', async () => {
    mockRequireAuth.mockResolvedValue(
      makeAuthContext({ capabilities: { canRead: true, canComment: false, canHighlight: false, canBookmark: true, canDownloadOffline: false, canExportNotes: false, canManageAccess: false } }),
    );
    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(403);
  });

  it('returns 400 for empty body', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', { body: '' });
    expect(res.status).toBe(400);
  });

  it('creates comment and returns data', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());

    const res = await handleCreateComment(makeEnv(), makeRequest(), 'book-1', validBody);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.body).toBe('This is a comment');
    expect(body.data.status).toBe('open');
    expect(body.data.visibility).toBe('shared');
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('PATCH /api/comments/{commentId} (handleUpdateComment)', () => {
  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(null);
    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(401);
  });

  it('returns 404 when comment not found', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue(null);

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(404);
  });

  it('returns 403 when editing another user\'s comment', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext({ email: 'other@example.com' }));
    mockQueryFirst.mockResolvedValue({
      id: 'comment-1',
      user_email: 'reader@example.com',
      body: 'original',
      status: 'open',
      visibility: 'shared',
      chapter_ref: null,
      cfi_range: null,
      selected_text: null,
      parent_comment_id: null,
      book_id: 'book-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
    });

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated' });
    expect(res.status).toBe(403);
  });

  it('updates comment body', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue({
      id: 'comment-1',
      user_email: 'reader@example.com',
      body: 'original',
      status: 'open',
      visibility: 'shared',
      chapter_ref: null,
      cfi_range: null,
      selected_text: null,
      parent_comment_id: null,
      book_id: 'book-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
    });

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { body: 'updated body' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('comment-1');
  });

  it('resolves comment when status set to resolved', async () => {
    mockRequireAuth.mockResolvedValue(makeAuthContext());
    mockQueryFirst.mockResolvedValue({
      id: 'comment-1',
      user_email: 'reader@example.com',
      body: 'original',
      status: 'open',
      visibility: 'shared',
      chapter_ref: null,
      cfi_range: null,
      selected_text: null,
      parent_comment_id: null,
      book_id: 'book-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
    });

    const res = await handleUpdateComment(makeEnv(), makeRequest(), 'comment-1', { status: 'resolved' });
    expect(res.status).toBe(200);
    expect(mockExecute).toHaveBeenCalled();
    const callArgs = mockExecute.mock.calls[0];
    expect(callArgs[1]).toContain('resolved_at');
  });
});

// ===========================================================================
// FILES: Signed URL download
// ===========================================================================

describe('GET /api/files/{bookId}/{fileKey} (handleDownloadBookFile)', () => {
  function makeFileUrlRequest(expires: string, signature: string): Request {
    return new Request(`https://test.example.com/api/files/book-1/books/book-1/epub/file.epub?expires=${expires}&signature=${signature}`);
  }

  it('returns 400 when signature parameters missing', async () => {
    const req = new Request('https://test.example.com/api/files/book-1/key');
    const res = await handleDownloadBookFile(makeEnv(), req, 'book-1', 'key');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when only expires provided', async () => {
    const req = new Request('https://test.example.com/api/files/book-1/key?expires=123');
    const res = await handleDownloadBookFile(makeEnv(), req, 'book-1', 'key');
    expect(res.status).toBe(400);
  });

  it('returns 403 when signature is expired', async () => {
    mockVerifyExpiry.mockReturnValue(false);
    mockVerifySignature.mockResolvedValue(true);

    const req = makeFileUrlRequest('1000000', 'valid-sig');
    const res = await handleDownloadBookFile(makeEnv(), req, 'book-1', 'key');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when signature is invalid', async () => {
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(false);

    const req = makeFileUrlRequest('9999999999', 'bad-sig');
    const res = await handleDownloadBookFile(makeEnv(), req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('returns 404 when file not found in bucket', async () => {
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(true);
    const env = makeEnv();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(env.BOOKS_BUCKET.get).mockResolvedValue(null);

    const req = makeFileUrlRequest('9999999999', 'valid-sig');
    const res = await handleDownloadBookFile(env, req, 'book-1', 'key');
    expect(res.status).toBe(404);
  });

  it('returns file body with correct headers when valid', async () => {
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(true);

    const mockBody = new ReadableStream();
    const mockWriteHttpMetadata = (headers: Headers) => {
      headers.set('Content-Type', 'application/epub+zip');
    };
    const mockObject = {
      key: 'books/book-1/epub/file.epub',
      body: mockBody,
      writeHttpMetadata: vi.fn(mockWriteHttpMetadata),
    };
    const env = makeEnv();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(env.BOOKS_BUCKET.get).mockResolvedValue(mockObject as never);

    const req = makeFileUrlRequest('9999999999', 'valid-sig');
    const res = await handleDownloadBookFile(env, req, 'book-1', 'books/book-1/epub/file.epub');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/epub+zip');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=0');
  });
});

// ===========================================================================
// ADMIN ROUTES
// ===========================================================================

describe('POST /api/admin/books (handleCreateBook)', () => {
  const validBody = {
    title: 'New Book',
    slug: 'new-book',
    authorName: 'Author Name',
    language: 'en',
    visibility: 'private' as const,
  };

  it('returns 400 for invalid body', async () => {
    const res = await handleCreateBook(makeEnv(), {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid slug format', async () => {
    const res = await handleCreateBook(makeEnv(), { title: 'Book', slug: 'INVALID SLUG!' });
    expect(res.status).toBe(400);
  });

  it('creates book and returns 201', async () => {
    const res = await handleCreateBook(makeEnv(), validBody, 'admin@example.com');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.slug).toBe('new-book');
    expect(body.data.title).toBe('New Book');
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('POST /api/admin/books/{bookId}/files (handleUploadComplete)', () => {
  const body = {
    storageKey: 'books/book-1/epub/file.epub',
    originalFilename: 'file.epub',
    mimeType: 'application/epub+zip',
    fileSizeBytes: 102400,
  };

  it('registers book file and returns 201', async () => {
    const res = await handleUploadComplete(makeEnv(), 'book-1', body);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.storageKey).toBe('books/book-1/epub/file.epub');
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('POST /api/admin/grants (handleCreateAdminGrant)', () => {
  const validBody = {
    bookId: '00000000-0000-0000-0000-000000000001',
    email: 'reader@example.com',
    mode: 'private' as const,
    commentsAllowed: false,
    offlineAllowed: false,
  };

  it('returns 400 for invalid body', async () => {
    const res = await handleCreateAdminGrant(makeEnv(), 'book-1', {});
    expect(res.status).toBe(400);
  });

  it('creates grant and returns 201', async () => {
    mockCreateGrant.mockResolvedValue('grant-1');

    const res = await handleCreateAdminGrant(makeEnv(), 'book-1', validBody, 'admin@example.com');
    expect(res.status).toBe(201);
    const body2 = await res.json();
    expect(body2.ok).toBe(true);
    expect(body2.data.email).toBe('reader@example.com');
  });
});

describe('PATCH /api/admin/grants/{grantId} (handleUpdateGrant)', () => {
  it('returns 400 for invalid body', async () => {
    const res = await handleUpdateGrant(makeEnv(), 'grant-1', { mode: 'invalid-mode' });
    expect(res.status).toBe(400);
  });

  it('updates grant fields', async () => {
    const res = await handleUpdateGrant(makeEnv(), 'grant-1', {
      mode: 'password_protected',
      commentsAllowed: true,
    }, 'admin@example.com');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.mode).toBe('password_protected');
    expect(mockExecute).toHaveBeenCalled();
  });
});

describe('DELETE /api/admin/grants/{grantId} (handleRevokeGrant)', () => {
  it('revokes grant and associated sessions', async () => {
    const res = await handleRevokeGrant(makeEnv(), 'grant-1', 'admin@example.com');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Should execute: UPDATE grant, UPDATE sessions, INSERT audit_log
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});

describe('GET /api/admin/books/{bookId}/grants (handleGetBookGrants)', () => {
  it('returns list of grants for a book', async () => {
    mockQueryAll.mockResolvedValue([
      makeGrantRow({ id: 'grant-1', email: 'user1@example.com' }),
      makeGrantRow({ id: 'grant-2', email: 'user2@example.com', comments_allowed: 1, offline_allowed: 1 }),
    ] as never);

    const res = await handleGetBookGrants(makeEnv(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].email).toBe('user1@example.com');
    expect(body.data[1].commentsAllowed).toBe(true);
    expect(body.data[1].offlineAllowed).toBe(true);
  });

  it('returns empty array when no grants exist', async () => {
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleGetBookGrants(makeEnv(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

describe('GET /api/admin/audit (handleGetAuditLog)', () => {
  it('returns audit log entries', async () => {
    mockQueryAll.mockResolvedValue([
      {
        id: 'audit-1',
        actor_email: 'admin@example.com',
        entity_type: 'book',
        entity_id: 'book-1',
        action: 'created',
        payload_json: JSON.stringify({ slug: 'test-book' }),
        created_at: new Date().toISOString(),
      },
    ] as never);

    const res = await handleGetAuditLog(makeEnv(), 'book', 'book-1', 10);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].entityType).toBe('book');
    expect(body.data[0].payload).toEqual({ slug: 'test-book' });
  });

  it('returns empty array when no entries match', async () => {
    mockQueryAll.mockResolvedValue([] as never);

    const res = await handleGetAuditLog(makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});

// ===========================================================================
// SIGNED URL EXPIRY VALIDATION (through route handler)
// ===========================================================================

describe('Signed URL expiry validation', () => {
  function makeFileUrlRequest(expires: string, signature: string): Request {
    return new Request(`https://test.example.com/api/files/book-1/key?expires=${expires}&signature=${signature}`);
  }

  it('returns 403 for non-numeric expires value', async () => {
    mockVerifyExpiry.mockReturnValue(false); // parseInt('not-a-number') = NaN -> false
    mockVerifySignature.mockResolvedValue(true);

    const req = makeFileUrlRequest('not-a-number', 'sig');
    const res = await handleDownloadBookFile(makeEnv(), req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('returns 403 for past expiry', async () => {
    mockVerifyExpiry.mockReturnValue(false);
    mockVerifySignature.mockResolvedValue(true);

    const pastEpoch = Math.floor(Date.now() / 1000) - 3600;
    const req = makeFileUrlRequest(pastEpoch.toString(), 'sig');
    const res = await handleDownloadBookFile(makeEnv(), req, 'book-1', 'key');
    expect(res.status).toBe(403);
  });

  it('passes validation for future expiry', async () => {
    mockVerifyExpiry.mockReturnValue(true);
    mockVerifySignature.mockResolvedValue(true);

    const futureEpoch = Math.floor(Date.now() / 1000) + 3600;
    const mockWriteHttpMetadata = (h: Headers) => {
      h.set('Content-Type', 'application/epub+zip');
    };
    const mockObject = {
      key: 'key',
      body: new ReadableStream(),
      writeHttpMetadata: vi.fn(mockWriteHttpMetadata),
    };
    const env = makeEnv();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(env.BOOKS_BUCKET.get).mockResolvedValue(mockObject as never);

    const req = makeFileUrlRequest(futureEpoch.toString(), 'valid-sig');
    const res = await handleDownloadBookFile(env, req, 'book-1', 'key');
    expect(res.status).toBe(200);
  });
});
