import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockQueryFirst,
  mockCreateResetToken,
  mockVerifyResetToken,
  mockBumpResetTokenAttempt,
  mockChangePasswordAndConsumeResetToken,
  mockAccountIsLocked,
  mockIsPasswordDerivative,
  mockRevokeAllAdminSessionsForUser,
  parseBody,
} from './fixtures';
import { app } from '../app';

vi.mock('../lib/email-transport', () => ({
  createEmailTransport: vi.fn(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
}));

const STRONG = 'Str0ng!Passphrase#2026';

describe('Security: Admin Recovery Flow', () => {
  const env = makeEnv();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountIsLocked.mockReturnValue(false);
    mockIsPasswordDerivative.mockReturnValue(false);
  });

  it('POST /api/admin/recovery-request succeeds for a valid admin email and mints a reset token', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', global_role: 'admin', disabled_at: null, compromised_at: null });
    mockCreateResetToken.mockResolvedValue('raw-reset-token');

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
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect(mockCreateResetToken).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ purpose: 'admin_reset', userId: 'admin-1' }),
    );
  });

  it('POST /api/admin/recovery-request returns success for a non-existent email (no enumeration)', async () => {
    mockQueryFirst.mockResolvedValue(null);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ghost@example.com' }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect(mockCreateResetToken).not.toHaveBeenCalled();
  });

  it('POST /api/admin/recovery-verify accepts newPassword+confirm, resets, revokes sessions, returns reset-complete (no login)', async () => {
    mockVerifyResetToken.mockResolvedValue({ ok: true, record: { id: 'rt-1', userId: 'admin-1', purpose: 'admin_reset' } });
    mockQueryFirst.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', disabled_at: null, compromised_at: null, global_role: 'admin' });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'reset-token', newPassword: STRONG, newPasswordConfirm: STRONG }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(200);
    const body = await parseBody(res);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ reset: true });
    expect(mockBumpResetTokenAttempt).toHaveBeenCalledWith(expect.anything(), 'rt-1');
    expect(mockChangePasswordAndConsumeResetToken).toHaveBeenCalledWith(expect.anything(), 'admin-1', STRONG, 'rt-1');
    expect(mockRevokeAllAdminSessionsForUser).toHaveBeenCalledWith(expect.anything(), 'admin-1');
  });

  it('rejects a reused (replayed) reset token as generic INVALID_TOKEN', async () => {
    mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'used' });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'reused', newPassword: STRONG, newPasswordConfirm: STRONG }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('INVALID_TOKEN');
    expect(mockChangePasswordAndConsumeResetToken).not.toHaveBeenCalled();
  });

  it('rejects an expired reset token and cannot change the password', async () => {
    mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'expired' });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'expired', newPassword: STRONG, newPasswordConfirm: STRONG }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('INVALID_TOKEN');
    expect(mockChangePasswordAndConsumeResetToken).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation (schema-level)', async () => {
    mockVerifyResetToken.mockResolvedValue({ ok: true, record: { id: 'rt-1', userId: 'admin-1', purpose: 'admin_reset' } });

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 't', newPassword: STRONG, newPasswordConfirm: 'Different123!' }),
      }),
      env,
      makePassThroughContext(),
    );

    // Zod validation failure routes through the validation error formatter.
    expect([400, 422]).toContain(res.status);
    expect(mockChangePasswordAndConsumeResetToken).not.toHaveBeenCalled();
  });

  it('rejects a weak/service-derivative password', async () => {
    mockVerifyResetToken.mockResolvedValue({ ok: true, record: { id: 'rt-1', userId: 'admin-1', purpose: 'admin_reset' } });
    mockQueryFirst.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', disabled_at: null, compromised_at: null, global_role: 'admin' });
    mockIsPasswordDerivative.mockReturnValue(true);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 't', newPassword: 'admin@example.com12345', newPasswordConfirm: 'admin@example.com12345' }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(400);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('WEAK_PASSWORD');
    expect(mockChangePasswordAndConsumeResetToken).not.toHaveBeenCalled();
  });

  it('returns generic INVALID_TOKEN for a lock-disabled account', async () => {
    mockVerifyResetToken.mockResolvedValue({ ok: true, record: { id: 'rt-1', userId: 'admin-1', purpose: 'admin_reset' } });
    mockQueryFirst.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', disabled_at: '2026-01-01T00:00:00Z', compromised_at: null, global_role: 'admin' });
    mockAccountIsLocked.mockReturnValue(true);

    const res = await app.fetch(
      new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 't', newPassword: STRONG, newPasswordConfirm: STRONG }),
      }),
      env,
      makePassThroughContext(),
    );

    expect(res.status).toBe(401);
    const body = await parseBody(res);
    expect(body.error?.code).toBe('INVALID_TOKEN');
    expect(mockChangePasswordAndConsumeResetToken).not.toHaveBeenCalled();
  });
});
