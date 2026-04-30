import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makeSessionRow,
  mockValidateGrant,
  mockCreateSession,
  mockRevokeSession,
  mockValidateSessionMod,
  mockGetGrantByBookAndSession,
  mockGetGrantsBySession,
} from './fixtures';
import {
  handleAccessRequest,
  handleLogout,
  handleRefresh,
  handleValidatePermission,
  handleValidateAllPermissions,
} from '../routes/access';

describe('POST /api/access/request (handleAccessRequest)', () => {
  const validPayload = {
    bookSlug: 'test-book',
    email: 'reader@example.com',
    password: 'secret123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error for missing fields', async () => {
    const res = await handleAccessRequest(makeEnv(), {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when grant validation fails', async () => {
    mockValidateGrant.mockResolvedValue({ valid: false, error: 'Access denied' });

    const res = await handleAccessRequest(makeEnv(), validPayload);
    expect(res.status).toBe(401);
    const body = await res.json();
     expect(body.error.code).toBe('ACCESS_DENIED');
  });

  it('creates session and returns token on valid grant', async () => {
    mockValidateGrant.mockResolvedValue({
      valid: true,
      grant: {
        id: 'grant-1',
        book_id: 'book-1',
        email: 'user@example.com',
        password_hash: null,
        mode: 'private',
        allowed: 1,
        comments_allowed: 0,
        offline_allowed: 0,
        expires_at: null,
        revoked_at: null,
      },
      book: {
        id: 'book-1',
        slug: 'test-book',
        title: 'Test Book',
        author_name: null,
        visibility: 'private',
        cover_image_url: null,
      },
    });
    mockCreateSession.mockResolvedValue('new-session-token');

    const res = await handleAccessRequest(makeEnv(), validPayload);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionToken).toBe('new-session-token');
  });
});

describe('POST /api/access/logout (handleLogout)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes session and returns ok', async () => {
    mockRevokeSession.mockResolvedValue(undefined as never);
    const res = await handleLogout(makeEnv(), 'session-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/access/refresh (handleRefresh)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for invalid session', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false } as never);
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
    } as never);
    mockCreateSession.mockResolvedValue('new-token');

    const res = await handleRefresh(makeEnv(), 'good-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.sessionToken).toBe('new-token');
  });
});

describe('GET /api/access/validate-permission (handleValidatePermission)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for invalid session', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false } as never);
    const res = await handleValidatePermission(makeEnv(), 'book-1', 'bad-token');
    expect(res.status).toBe(401);
  });

  it('returns invalid grant when grant is revoked', async () => {
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow(),
      bookId: 'book-1',
    } as never);
    mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: new Date().toISOString() } as never);

    const res = await handleValidatePermission(makeEnv(), 'book-1', 'good-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.valid).toBe(false);
  });

  it('returns valid when grant is active', async () => {
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow(),
      bookId: 'book-1',
    } as never);
    mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: null } as never);

    const res = await handleValidatePermission(makeEnv(), 'book-1', 'good-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.valid).toBe(true);
  });
});

describe('GET /api/access/validate-all-permissions (handleValidateAllPermissions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for invalid session', async () => {
    mockValidateSessionMod.mockResolvedValue({ valid: false } as never);
    const res = await handleValidateAllPermissions(makeEnv(), 'bad-token');
    expect(res.status).toBe(401);
  });

  it('returns valid grant IDs and revoked book IDs', async () => {
    mockValidateSessionMod.mockResolvedValue({
      valid: true,
      session: makeSessionRow(),
      bookId: 'book-1',
    } as never);
    mockGetGrantsBySession.mockResolvedValue([
      { id: 'grant-1', book_id: 'book-1', revoked_at: null },
      { id: 'grant-2', book_id: 'book-2', revoked_at: new Date().toISOString() },
    ] as never);

    const res = await handleValidateAllPermissions(makeEnv(), 'good-token');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.grantIds).toContain('grant-1');
    expect(body.data.revokedBookIds).toContain('book-2');
  });
});
