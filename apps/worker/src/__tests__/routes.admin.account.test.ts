import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockRequireAdminAuth,
  mockGetAccountByEmail,
  mockAccountIsLocked,
  mockIsPasswordDerivative,
  mockVerifyAccountPassword,
  mockChangePassword,
  mockRevokeAllAdminSessionsForUser,
  mockListAdminSessionsForUser,
  mockRaiseAdminAssurance,
  mockHashAdminToken,
  parseBody,
} from './fixtures';
import { app } from '../app';

const STRONG = 'Str0ng!Passphrase#2026';

const adminContext = {
  userId: 'admin-1',
  email: 'admin@example.com',
  globalRole: 'admin' as const,
  token: 'session-token',
};

describe('Admin Account Lifecycle + Session Hardening (ADR-231/234)', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminAuth.mockResolvedValue({ ok: true, context: adminContext });
    mockHashAdminToken.mockResolvedValue('current-hash');
    mockAccountIsLocked.mockReturnValue(false);
    mockIsPasswordDerivative.mockReturnValue(false);
    mockVerifyAccountPassword.mockResolvedValue(true);
  });

  it('POST /api/admin/account/password-change rotates other sessions on success', async () => {
    mockGetAccountByEmail.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', global_role: 'admin', password_hash: 'x', disabled_at: null, compromised_at: null, email_verified_at: null });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
        body: JSON.stringify({ currentPassword: 'oldPass1!', newPassword: STRONG, newPasswordConfirm: STRONG }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect(mockChangePassword).toHaveBeenCalledWith(expect.anything(), 'admin-1', STRONG);
    // Keeps current session, revokes all others (ADR-234 rotation).
    expect(mockRevokeAllAdminSessionsForUser).toHaveBeenCalledWith(expect.anything(), 'admin-1', { exceptTokenHash: 'current-hash' });
  });

  it('rejects password-change when the current password is wrong', async () => {
    mockGetAccountByEmail.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', global_role: 'admin', password_hash: 'x', disabled_at: null, compromised_at: null, email_verified_at: null });
    mockVerifyAccountPassword.mockResolvedValue(false);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
        body: JSON.stringify({ currentPassword: 'wrong', newPassword: STRONG, newPasswordConfirm: STRONG }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('GET /api/admin/account/sessions lists current + other sessions without exposing tokens', async () => {
    mockListAdminSessionsForUser.mockResolvedValue([
      { id: 's1', created_at: '2026-08-13T00:00:00Z', last_used_at: '2026-08-13T00:00:00Z', expires_at: '2026-08-13T08:00:00Z', assurance_level: 'password', device_label_hash: null, current: true },
    ]);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/sessions', { headers: { Authorization: 'Bearer session-token' } }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect((body.data.sessions as Array<{ assurance_level: string }>)[0].assurance_level).toBe('password');
    expect(JSON.stringify(body.data.sessions)).not.toContain('token_hash');
    expect(mockListAdminSessionsForUser).toHaveBeenCalledWith(expect.anything(), 'admin-1', 'current-hash');
  });

  it('POST /api/admin/account/logout-all revokes all sessions except current', async () => {
    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect(mockRevokeAllAdminSessionsForUser).toHaveBeenCalledWith(expect.anything(), 'admin-1', { exceptTokenHash: 'current-hash' });
  });

  it('POST /api/admin/account/step-up raises assurance and returns a rotated token', async () => {
    mockRaiseAdminAssurance.mockResolvedValue({ ok: true, token: 'rotated-token' });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
        body: JSON.stringify({ currentPassword: 'secretPass1' }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect(body.data.token as string).toBe('rotated-token');
    expect(mockRaiseAdminAssurance).toHaveBeenCalledWith(expect.anything(), 'session-token', 'step_up');
  });

  it('rejects step-up with a wrong password', async () => {
    mockVerifyAccountPassword.mockResolvedValue(false);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
        body: JSON.stringify({ currentPassword: 'wrong' }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    expect(mockRaiseAdminAssurance).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests to account endpoints', async () => {
    mockRequireAdminAuth.mockResolvedValue({ ok: false, status: 401, error: 'Missing authorization token' });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/account/sessions', {}),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
  });
});
