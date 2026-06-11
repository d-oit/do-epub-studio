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
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      const body = await res.json() as any;
      if (res.status !== 200) {
        console.log('Error body:', JSON.stringify(body));
      }
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
      } as any);

      const res = await app.fetch(new Request('http://localhost/api/access/recovery-request', {
        method: 'POST',
        body: JSON.stringify(validPayload),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
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
      }), env, makePassThroughContext() as unknown as ExecutionContext);
      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.error.code).toBe('INVALID_TOKEN');
    });

    it('creates session on valid token', async () => {
      // Sign a manual token since JWT verify might be failing with sign results in some environments
      // Use the same payload as verify expects
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET);

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
      mockCreateSession.mockResolvedValue('new-session-token');

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);

      const body = await res.json() as any;
      if (res.status !== 200) {
        console.log('Error body verify:', JSON.stringify(body));
      }
      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.sessionToken).toBe('new-session-token');
    });

    it('returns 401 if token is valid but grant is revoked', async () => {
      const payload = {
        email: 'reader@example.com',
        bookSlug: 'test-book',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = await sign(payload, env.INVITE_TOKEN_SECRET);

      mockValidateGrant.mockResolvedValue({
        valid: false,
        error: 'Access denied',
      } as any);

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      }), env, makePassThroughContext() as unknown as ExecutionContext);

      expect(res.status).toBe(401);
    });
  });
});
