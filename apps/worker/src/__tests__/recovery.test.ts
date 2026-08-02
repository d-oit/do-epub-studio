import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockValidateGrant,
  mockCreateSession,
  mockGetGrantByBookAndSession,
  mockQueryFirst,
  mockComputeCapabilities,
} from './fixtures';
import { app } from '../app';
import { sign } from 'hono/jwt';
import { JWT_PURPOSE_READER_RECOVER, JWT_PURPOSE_ADMIN_RECOVER } from '@do-epub-studio/schema';

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
    });

    it('returns success and logs magic link when book and grant exist', async () => {
      mockQueryFirst.mockResolvedValue({ id: 'book-1', slug: 'test-book' });
      mockGetGrantByBookAndSession.mockResolvedValue({
        id: 'grant-1',
        book_id: 'book-1',
        email: 'reader@example.com',
        revoked_at: null,
        expires_at: null,
      });

      const res = await app.fetch(new Request('http://localhost/api/access/recovery-request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      // Audit log check would happen here if we had a spy on logAudit
    });
  });

  describe('POST /api/access/verify-recovery', () => {
    it('returns 401 for invalid token', async () => {
      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token: 'invalid-token' }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());
      expect(res.status).toBe(401);
      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('creates session on valid token', async () => {
      // Sign a manual token since JWT verify might be failing with sign results in some environments
      // Use the same payload as verify expects
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        purpose: JWT_PURPOSE_READER_RECOVER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      // Use the same secret that the worker will use in the test environment
      const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

      mockValidateGrant.mockResolvedValue({
        valid: true,
        grant: {
          id: 'grant-1',
          allowed: 1,
          comments_allowed: 0,
          offline_allowed: 0,
        },
        book: {
          id: 'book-1',
          slug: 'test-book',
          title: 'Test',
          author_name: null,
          visibility: 'private',
          cover_image_url: null,
        },
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
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      const body: { ok: boolean; data: Record<string, unknown>; error: { code: string } } = await res.json();
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-session-token');
    });

    it('returns 401 if token is valid but grant is revoked', async () => {
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        purpose: JWT_PURPOSE_READER_RECOVER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

      mockValidateGrant.mockResolvedValue({
        valid: false,
        error: 'Access denied',
      });

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
    });

    it('returns 401 if token is valid but has incorrect purpose', async () => {
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        purpose: 'invalid_purpose',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('returns 401 if token is valid but has no purpose', async () => {
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
    it('returns 401 if token has admin purpose submitted to reader endpoint (cross-context)', async () => {
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        purpose: JWT_PURPOSE_ADMIN_RECOVER,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
      expect(mockValidateGrant).not.toHaveBeenCalled();
    });

    it('returns 401 if token is expired', async () => {
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        purpose: JWT_PURPOSE_READER_RECOVER,
        exp: Math.floor(Date.now() / 1000) - 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext());

      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
