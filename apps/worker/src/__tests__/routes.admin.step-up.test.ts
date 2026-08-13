import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockTransaction,
  mockRequireAdminAuth,
  mockHashAdminToken,
} from './fixtures';
import { app } from '../app';
import type { AdminAssuranceLevel } from '../auth/admin-middleware';

// ADR-234: step-up reauthentication enforcement for sensitive admin mutations.
//
// The fixtures mock `requireAdminAuth` (adminAuth) and `hashToken`, so these
// tests drive only the `requireStepUp` middleware layer: it re-reads the bearer
// token, hashes it, and looks up the admin session's assurance_level via
// queryFirst before letting the guarded mutation proceed.

const GUARDED_REVOKE_URL = 'http://localhost/api/admin/grants/grant-1/revoke';

describe('Admin Step-Up Reauthentication (ADR-234)', () => {
  const env = makeEnv();

  const mockAdminAuth = () =>
    mockRequireAdminAuth.mockResolvedValue({
      ok: true,
      context: { userId: 'admin-1', email: 'admin@example.com', globalRole: 'admin' },
    });

  /** Arrange a session at the given assurance level (or unknown when null). */
  const mockStepUpSession = (assurance: AdminAssuranceLevel | null) => {
    mockHashAdminToken.mockResolvedValue('hash-of-token');
    mockQueryFirst.mockResolvedValue(
      assurance === null ? null : { assurance_level: assurance },
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminAuth();
    mockTransaction.mockResolvedValue(undefined);
  });

  describe('POST /api/admin/grants/:id/revoke (guarded mutation)', () => {
    it('rejects a low-assurance (password) session with 428 STEP_UP_REQUIRED', async () => {
      mockStepUpSession('password');

      const res = await app.fetch(
        new Request(GUARDED_REVOKE_URL, {
          method: 'POST',
          headers: { Authorization: 'Bearer low-assurance-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(428);
      const body: { ok: boolean; error: { code: string; message: string } } = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('STEP_UP_REQUIRED');
      expect(body.error.message).toBe('Step-up authentication required');
      expect(res.headers.get('X-Step-Up-Required')).toBe('true');
      // The mutation must not have run.
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('rejects a none-assurance session with 428 STEP_UP_REQUIRED', async () => {
      mockStepUpSession('none');

      const res = await app.fetch(
        new Request(GUARDED_REVOKE_URL, {
          method: 'POST',
          headers: { Authorization: 'Bearer low-assurance-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(428);
      expect(res.headers.get('X-Step-Up-Required')).toBe('true');
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('allows a step_up-assured session to pass the guard', async () => {
      mockStepUpSession('step_up');

      const res = await app.fetch(
        new Request(GUARDED_REVOKE_URL, {
          method: 'POST',
          headers: { Authorization: 'Bearer elevated-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      const body: { ok: boolean } = await res.json();
      expect(body.ok).toBe(true);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('allows an mfa-assured session to pass the guard', async () => {
      mockStepUpSession('mfa');

      const res = await app.fetch(
        new Request(GUARDED_REVOKE_URL, {
          method: 'POST',
          headers: { Authorization: 'Bearer elevated-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(200);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('rejects an unknown token with 401', async () => {
      mockStepUpSession(null);

      const res = await app.fetch(
        new Request(GUARDED_REVOKE_URL, {
          method: 'POST',
          headers: { Authorization: 'Bearer unknown-token' },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(401);
      const body: { ok: boolean; error: { code: string } } = await res.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('guarded mutation coverage', () => {
    it('guards book file upload (PUT /api/admin/books/:id/upload)', async () => {
      mockStepUpSession('password');

      const res = await app.fetch(
        new Request('http://localhost/api/admin/books/book-1/upload', {
          method: 'PUT',
          body: 'not-an-epub',
          headers: {
            'Content-Type': 'application/epub+zip',
            'Content-Length': '12',
            Authorization: 'Bearer low-assurance-token',
          },
        }),
        env,
        makePassThroughContext(),
      );

      expect(res.status).toBe(428);
      expect(mockQueryFirst).toHaveBeenCalled();
    });
  });
});
