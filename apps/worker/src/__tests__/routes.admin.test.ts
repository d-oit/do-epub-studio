import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeEnv, makeGrantRow, makeAuditLogRow, mockQueryAll, mockExecute } from './fixtures';
import {
  handleCreateBook,
  handleUploadComplete,
  handleCreateAdminGrant,
  handleUpdateGrant,
  handleRevokeGrant,
  handleGetBookGrants,
  handleGetAuditLog,
} from '../routes/admin';

describe('POST /api/admin/books (handleCreateBook)', () => {
  const validBody = {
    title: 'New Book',
    slug: 'new-book',
    authorName: 'Author Name',
    language: 'en',
    visibility: 'private' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const res = await handleCreateBook(makeEnv(), {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates book and returns success', async () => {
    mockExecute.mockResolvedValue({} as never);

    const res = await handleCreateBook(makeEnv(), validBody, 'admin@example.com');
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/admin/books/{bookId}/files (handleUploadComplete)', () => {
  const body = {
    storageKey: 'books/book-1/epub/file.epub',
    originalFilename: 'file.epub',
    mimeType: 'application/epub+zip',
    fileSizeBytes: 102400,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers book file and returns 201', async () => {
    mockExecute.mockResolvedValue({} as never);

    const res = await handleUploadComplete(makeEnv(), 'book-1', body);
    expect(res.status).toBe(201);
    const bodyRes = await res.json();
    expect(bodyRes.ok).toBe(true);
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const res = await handleCreateAdminGrant(makeEnv(), 'book-1', {});
    expect(res.status).toBe(400);
  });

  it('creates grant and returns success', async () => {
    mockExecute.mockResolvedValue({} as never);

    const res = await handleCreateAdminGrant(makeEnv(), 'book-1', validBody, 'admin@example.com');
    expect(res.status).toBe(201);
    const bodyRes = await res.json();
    expect(bodyRes.ok).toBe(true);
  });
});

describe('PATCH /api/admin/grants/{grantId} (handleUpdateGrant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const res = await handleUpdateGrant(makeEnv(), 'grant-1', { mode: 'invalid-mode' });
    expect(res.status).toBe(400);
  });

  it('updates grant fields', async () => {
    mockExecute.mockResolvedValue({} as never);

    const res = await handleUpdateGrant(
      makeEnv(),
      'grant-1',
      { mode: 'password_protected', commentsAllowed: true },
      'admin@example.com',
    );
    expect(res.status).toBe(200);
    const bodyRes = await res.json();
    expect(bodyRes.ok).toBe(true);
  });
});

describe('DELETE /api/admin/grants/{grantId} (handleRevokeGrant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes grant and associated sessions', async () => {
    mockExecute.mockResolvedValue({} as never);

    const res = await handleRevokeGrant(makeEnv(), 'grant-1', 'admin@example.com');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // Should execute: UPDATE grant, UPDATE sessions, INSERT audit_log
    expect(mockExecute).toHaveBeenCalledTimes(3);
  });
});

describe('GET /api/admin/books/{bookId}/grants (handleGetBookGrants)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns list of grants for a book', async () => {
    mockQueryAll.mockResolvedValue([
      makeGrantRow({ id: 'grant-1', email: 'user1@example.com' }),
      makeGrantRow({
        id: 'grant-2',
        email: 'user2@example.com',
        comments_allowed: 1,
        offline_allowed: 1,
      }),
    ] as never);

    const res = await handleGetBookGrants(makeEnv(), 'book-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });
});

describe('GET /api/admin/audit (handleGetAuditLog)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns audit log entries', async () => {
    mockQueryAll.mockResolvedValue([makeAuditLogRow()] as never);

    const res = await handleGetAuditLog(makeEnv(), 'book', 'book-1', 100);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
  });
});
