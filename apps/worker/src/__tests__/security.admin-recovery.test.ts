import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockCreateAdminSessionByEmail,
} from './fixtures';
import { app } from '../app';
import { sign } from 'hono/jwt';
import { JWT_PURPOSE_ADMIN_RECOVER, JWT_PURPOSE_READER_RECOVER } from '@do-epub-studio/schema';

describe('Security: Admin Recovery Flow', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/admin/recovery-request should succeed for valid admin email', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com' }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed for property access
    const body = await res.json() as { ok: boolean; data?: { token: string; user?: { role: string } } };
    expect(body.ok).toBe(true);
    // Verify it used global_role in the check (by implication of queryFirst being called)
    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('global_role = ?'),
      ['admin@example.com', 'admin']
    );
  });

  it('POST /api/admin/recovery-verify should succeed with valid token', async () => {
    const payload = {
      email: 'admin@example.com',
      purpose: JWT_PURPOSE_ADMIN_RECOVER,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

    mockQueryFirst.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      global_role: 'admin'
    });

    mockCreateAdminSessionByEmail.mockResolvedValue({
      ok: true,
      token: 'session-token',
      user: { id: 'admin-1', email: 'admin@example.com', role: 'admin' }
    });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed for property access
    const body = await res.json() as { ok: boolean; data?: { token: string; user?: { role: string } } };
    expect(body.ok).toBe(true);
    expect(body.data?.token).toBe('session-token');
    expect(body.data?.user?.role).toBe('admin');
  });

  it('returns 401 if token has wrong purpose', async () => {
    const payload = {
      email: 'admin@example.com',
      purpose: 'invalid_purpose',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed for property access
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 if token has no purpose', async () => {
    const payload = {
      email: 'admin@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed for property access
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 if token is expired', async () => {
    const payload = {
      email: 'admin@example.com',
      purpose: JWT_PURPOSE_ADMIN_RECOVER,
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed for property access
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 if reader-purpose token submitted to admin endpoint (cross-context)', async () => {
    const payload = {
      email: 'admin@example.com',
      purpose: JWT_PURPOSE_READER_RECOVER,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = await sign(payload, env.INVITE_TOKEN_SECRET, 'HS256');

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- needed for property access
    const body = await res.json() as { ok: boolean; error: { code: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(mockQueryFirst).not.toHaveBeenCalled();
  });
});
