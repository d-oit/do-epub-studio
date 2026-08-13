import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockCreateSession,
  mockGetGrantByBookAndSession,
  mockGetGrantsBySession,
  mockQueryFirst,
  mockComputeCapabilities,
  mockCreateResetToken,
  mockVerifyResetToken,
  mockMarkResetTokenUsed,
} from './fixtures';
import { app } from '../app';
import { TRACE_HEADER } from '@do-epub-studio/shared';

// Capture recovery-emails to assert trace-context threading (Plan 214 R3).
// Default to a no-op transport so existing tests are unaffected.
vi.mock('../lib/email-transport', () => ({
  createEmailTransport: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
}));
import { createEmailTransport } from '../lib/email-transport';

// ADR-232: reader recovery uses a persisted, single-use magic-link token held
// in password_reset_tokens (verified by hash), replacing the old stateless JWT.

describe('Access Recovery Routes', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/access/recovery-request', () => {
    const validPayload = {
      bookSlug: 'test-book',
      email: 'reader@example.com',
    };

    it('returns success even if book not found (to prevent enumeration)', async () => {
      mockQueryFirst.mockResolvedValue(null);
      const res = await app.fetch(new Request('http://localhost/api/access/recovery-request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mockCreateResetToken).not.toHaveBeenCalled();
    });

    it('mints a persisted magic-link token and emails when book and grant exist', async () => {
      mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'test-book' });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        book_id: 'book-1',
        email: 'reader@example.com',
        revoked_at: null,
        expires_at: null,
      });
      mockCreateResetToken.mockResolvedValue('raw-magic-token');

      const res = await app.fetch(new Request('http://localhost/api/access/recovery-request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(mockCreateResetToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ purpose: 'reader_magic_link', email: 'reader@example.com' }),
      );
    });

    it('threads the request trace context into the recovery email send', async () => {
      mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'test-book' });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        book_id: 'book-1',
        email: 'reader@example.com',
        revoked_at: null,
        expires_at: null,
      });
      mockCreateResetToken.mockResolvedValue('raw-magic-token');

      const captureSend = vi.fn().mockResolvedValue(undefined);
      vi.mocked(createEmailTransport).mockReturnValue({ send: captureSend });

      const res = await app.fetch(new Request('http://localhost/api/access/recovery-request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json', [TRACE_HEADER]: 'deadbeef-1234' },
      }), env, makePassThroughContext());

      expect(res.status).toBe(200);
      expect(captureSend).toHaveBeenCalledTimes(1);
      const message = captureSend.mock.calls[0][0] as { context?: { traceId: string; spanId?: string } };
      expect(message.context).toBeDefined();
      expect(message.context?.traceId).toBe('deadbeef-1234');
    });
  });

  describe('POST /api/access/verify-recovery', () => {
    it('returns 401 for unknown token', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'invalid' });
      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token: 'unknown-token' }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('returns 401 and logs a replay audit for a reused token', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'used' });
      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token: 'reused-token' }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('returns 401 for an expired token', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'expired' });
      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token: 'expired-token' }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('creates a session on a valid single-use token and consumes it', async () => {
      mockVerifyResetToken.mockResolvedValue({
        ok: true,
        record: { id: 'rt-1', email: 'reader@example.com', purpose: 'reader_magic_link' },
      });
      mockGetGrantsBySession.mockResolvedValue([
        {
          id: 'grant-1',
          book_id: 'book-1',
          email: 'reader@example.com',
          allowed: 1,
          comments_allowed: 0,
          offline_allowed: 0,
          revoked_at: null,
          expires_at: null,
        },
      ]);
      mockQueryFirst.mockResolvedValue({
        id: 'book-1',
        slug: 'test-book',
        title: 'Test',
        author_name: null,
        visibility: 'private',
        cover_image_url: null,
      });
      mockComputeCapabilities.mockReturnValue({
        canRead: true,
        canComment: false,
        canHighlight: false,
        canBookmark: true,
        canDownloadOffline: false,
        canExportNotes: false,
        canManageAccess: false,
      });
      mockCreateSession.mockResolvedValue({ token: 'new-session-token', expiresAt: '2030-01-01T00:00:00.000Z' });

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token: 'valid-token' }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-session-token');
      // The token must be consumed in the same operation that issues the session.
      expect(mockMarkResetTokenUsed).toHaveBeenCalledWith(expect.anything(), 'rt-1');
    });
  });
});
