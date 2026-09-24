import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@do-epub-studio/shared';
import {
  makeEnv,
  makePassThroughContext,
  mockCreateSession,
  mockGetGrantByBookAndSession,
  mockComputeCapabilities,
  mockHashToken,
  mockLogAudit,
  mockQueryFirst,
} from './fixtures';
import { app } from '../app';

const acceptMock = vi.hoisted(() => vi.fn());
const checkRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock('../auth/invitations', () => ({
  acceptBookInvitation: acceptMock,
}));
vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: checkRateLimitMock,
  deleteRateLimitKey: vi.fn(),
}));

const env = makeEnv();
const ctx = makePassThroughContext();
const validBody = {
  token: 'a'.repeat(64),
  newPassword: 'A-long-invite-passphrase!',
  newPasswordConfirm: 'A-long-invite-passphrase!',
};

function request(body: unknown = validBody): Request {
  return new Request('http://localhost/api/access/accept-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/access/accept-invite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
    mockHashToken.mockResolvedValue('hashed-token');
    acceptMock.mockResolvedValue({
      invitationId: 'invite-1',
      userId: 'user-1',
      grantId: 'grant-1',
      bookId: 'book-1',
      email: 'reader@example.com',
      role: 'reader',
    });
    mockQueryFirst.mockResolvedValue({
      id: 'book-1',
      slug: 'book-one',
      title: 'Book One',
      author_name: null,
      visibility: 'private',
      cover_image_url: null,
    });
    mockGetGrantByBookAndSession.mockResolvedValue({
      id: 'grant-1',
      book_id: 'book-1',
      email: 'reader@example.com',
      password_hash: 'hash',
      mode: 'private',
      allowed: 1,
      comments_allowed: 1,
      offline_allowed: 1,
      expires_at: null,
      revoked_at: null,
    });
    mockComputeCapabilities.mockReturnValue({
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: true,
      canExportNotes: true,
      canManageAccess: false,
    });
    mockCreateSession.mockResolvedValue({ token: 'session-token', expiresAt: '2099-01-01T00:00:00.000Z' });
  });

  it('returns a reader session and book metadata after acceptance', async () => {
    const response = await app.fetch(request(), env, ctx);
    expect(response.status).toBe(200);
    const body: { ok: boolean; data: Record<string, unknown> } = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      sessionToken: 'session-token',
      email: 'reader@example.com',
      role: 'reader',
      book: { slug: 'book-one' },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ entityType: 'book-invitation', action: 'accepted' }),
      expect.anything(),
    );
  });

  it('audits a denied acceptance without returning the token', async () => {
    acceptMock.mockRejectedValue(new AppError('This invitation is invalid or expired', 'INVITATION_INVALID', 410));
    const response = await app.fetch(request(), env, ctx);
    expect(response.status).toBe(410);
    const text = await response.text();
    expect(text).not.toContain(validBody.token);
    expect(mockLogAudit).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ action: 'acceptance_denied' }),
      expect.anything(),
    );
  });

  it('fails closed when the acceptance rate limit denies the request', async () => {
    checkRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    const response = await app.fetch(request(), env, ctx);
    expect(response.status).toBe(429);
    expect(acceptMock).not.toHaveBeenCalled();
  });
});
