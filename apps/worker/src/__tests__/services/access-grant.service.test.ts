import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockGetGrantByBookAndSession,
  mockGetGrantsBySession,
  mockValidateGrant,
  mockCreateSession,
  mockRevokeSession,
  mockValidateSessionMod,
  mockCreateResetToken,
  mockVerifyResetToken,
  mockClaimResetToken,
  mockComputeCapabilities,
} from '../fixtures';
import { AccessGrantService } from '../../services/access-grant.service';

vi.mock('../../lib/rate-limit-client', () => ({
  checkRateLimitDO: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 5, resetAt: Date.now() + 60000 }),
  deleteRateLimitKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/email-transport', () => ({
  createEmailTransport: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
}));

describe('AccessGrantService', () => {
  const env = makeEnv();
  const passCtx = makePassThroughContext();
  const reqCtx = {
    startedAt: Date.now(),
    method: 'POST',
    path: '/api/access',
    traceId: 'trace-123',
    spanId: 'span-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestRecovery', () => {
    it('returns ok true even if book is not found (anti-enumeration)', async () => {
      mockQueryFirst.mockResolvedValue(null);
      const res = await AccessGrantService.requestRecovery({
        env,
        bookSlug: 'nonexistent',
        email: 'user@example.com',
        clientIp: '127.0.0.1',
        requestContext: reqCtx,
        executionCtx: passCtx,
      });
      expect(res.ok).toBe(true);
      expect(mockCreateResetToken).not.toHaveBeenCalled();
    });

    it('creates reset token and triggers email when grant is active', async () => {
      mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'my-book' });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        revoked_at: null,
        expires_at: null,
      });
      mockCreateResetToken.mockResolvedValue('token-abc');

      const res = await AccessGrantService.requestRecovery({
        env,
        bookSlug: 'my-book',
        email: 'user@example.com',
        clientIp: '127.0.0.1',
        requestContext: reqCtx,
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(true);
      expect(mockCreateResetToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ email: 'user@example.com', bookId: 'book-1' }),
      );
    });

    it('does not send email if grant is revoked or expired', async () => {
      mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'my-book' });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        revoked_at: '2020-01-01',
        expires_at: null,
      });

      const res = await AccessGrantService.requestRecovery({
        env,
        bookSlug: 'my-book',
        email: 'user@example.com',
        clientIp: '127.0.0.1',
        requestContext: reqCtx,
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(true);
      expect(mockCreateResetToken).not.toHaveBeenCalled();
    });
  });

  describe('verifyRecovery', () => {
    it('returns 401 when reset token is invalid or expired', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'expired' });

      const res = await AccessGrantService.verifyRecovery({
        env,
        token: 'bad-token',
        clientIp: '127.0.0.1',
        requestContext: reqCtx,
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
      expect(res.error).toBe('INVALID_TOKEN');
    });

    it('creates a session when reset token is valid', async () => {
      mockVerifyResetToken.mockResolvedValue({
        ok: true,
        record: { id: 'rt-1', email: 'user@example.com', bookId: 'book-1' },
      });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        book_id: 'book-1',
        email: 'user@example.com',
        allowed: 1,
        comments_allowed: 1,
        offline_allowed: 0,
        revoked_at: null,
        expires_at: null,
      });
      mockClaimResetToken.mockResolvedValue(true);
      mockQueryFirst.mockResolvedValue({
        id: 'book-1',
        slug: 'my-book',
        title: 'Book Title',
        author_name: 'Author',
        visibility: 'private',
        cover_image_url: null,
      });
      mockCreateSession.mockResolvedValue({ token: 'sess-123', expiresAt: '2030-01-01' });
      mockComputeCapabilities.mockReturnValue({ canRead: true, canComment: true });

      const res = await AccessGrantService.verifyRecovery({
        env,
        token: 'good-token',
        clientIp: '127.0.0.1',
        requestContext: reqCtx,
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(true);
      expect(res.data?.sessionToken).toBe('sess-123');
      expect(mockClaimResetToken).toHaveBeenCalledWith(expect.anything(), 'rt-1');
    });
  });

  describe('requestAccess', () => {
    it('returns 401 when grant validation fails', async () => {
      mockValidateGrant.mockResolvedValue({ valid: false, error: 'Bad password' });

      const res = await AccessGrantService.requestAccess({
        env,
        bookSlug: 'my-book',
        email: 'user@example.com',
        password: 'wrongpassword',
        clientIp: '127.0.0.1',
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(false);
      expect(res.status).toBe(401);
      expect(res.error).toBe('ACCESS_DENIED');
    });

    it('mints session and returns capabilities on valid grant', async () => {
      mockValidateGrant.mockResolvedValue({
        valid: true,
        grant: { id: 'grant-1', allowed: 1 },
        book: {
          id: 'book-1',
          slug: 'my-book',
          title: 'Title',
          author_name: null,
          visibility: 'private',
          cover_image_url: null,
        },
      });
      mockCreateSession.mockResolvedValue({ token: 'sess-abc', expiresAt: '2030-01-01' });

      const res = await AccessGrantService.requestAccess({
        env,
        bookSlug: 'my-book',
        email: 'user@example.com',
        password: 'correctpassword',
        clientIp: '127.0.0.1',
        executionCtx: passCtx,
      });

      expect(res.ok).toBe(true);
      expect(res.data?.sessionToken).toBe('sess-abc');
    });
  });

  describe('refreshSession', () => {
    it('returns 403 if grant is revoked during refresh', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      });
      mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: '2025-01-01' });

      const res = await AccessGrantService.refreshSession(env, 'old-token');

      expect(res.ok).toBe(false);
      expect(res.status).toBe(403);
      expect(res.error).toBe('ACCESS_DENIED');
    });

    it('rotates session token if grant is active', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
        bookId: 'book-1',
      });
      mockGetGrantByBookAndSession.mockResolvedValue({ revoked_at: null, expires_at: null });
      mockCreateSession.mockResolvedValue({ token: 'new-token', expiresAt: '2030-01-01' });

      const res = await AccessGrantService.refreshSession(env, 'old-token');

      expect(res.ok).toBe(true);
      expect(res.data?.sessionToken).toBe('new-token');
      expect(mockRevokeSession).toHaveBeenCalledWith(expect.anything(), 'old-token');
    });
  });

  describe('validateBookAccess & validateAllAccess', () => {
    it('validateBookAccess returns valid false when grant is expired', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
      });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        revoked_at: null,
        expires_at: '2020-01-01T00:00:00Z',
      });

      const res = await AccessGrantService.validateBookAccess(env, 'token', 'book-1');

      expect(res.ok).toBe(true);
      expect(res.data?.valid).toBe(false);
    });

    it('validateAllAccess separates valid and revoked grant book IDs', async () => {
      mockValidateSessionMod.mockResolvedValue({
        valid: true,
        session: { email: 'user@example.com' },
      });
      mockGetGrantsBySession.mockResolvedValue([
        { id: 'grant-1', book_id: 'book-1', revoked_at: null },
        { id: 'grant-2', book_id: 'book-2', revoked_at: '2025-01-01' },
      ]);

      const res = await AccessGrantService.validateAllAccess(env, 'token');

      expect(res.ok).toBe(true);
      expect(res.data?.grantIds).toEqual(['grant-1']);
      expect(res.data?.revokedBookIds).toEqual(['book-2']);
    });
  });
});
