import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeEnv,
  makePassThroughContext,
  mockCreateAdminSession,
  mockGetAccountByEmail,
  mockAccountIsLocked,
  mockVerifyResetToken,
} from './fixtures';
import { app } from '../app';

const {
  mockLogRiskEvent,
  mockDeviceFingerprint,
  mockCheckRateLimitDO,
  mockFindLoginTicket,
} = vi.hoisted(() => ({
  mockLogRiskEvent: vi.fn(),
  mockDeviceFingerprint: vi.fn(),
  mockCheckRateLimitDO: vi.fn(),
  mockFindLoginTicket: vi.fn(),
}));

vi.mock('../audit/risk', () => ({
  logRiskEvent: mockLogRiskEvent,
  deviceFingerprint: mockDeviceFingerprint,
  RISK_EVENTS: {
    tokenReplay: 'risk_token_replay',
    loginLocked: 'risk_login_locked',
    suspiciousDeviceChange: 'risk_suspicious_device_change',
  },
}));

vi.mock('../lib/rate-limit-client', () => ({
  checkRateLimitDO: mockCheckRateLimitDO,
  deleteRateLimitKey: vi.fn(),
}));

// Partial auth/mfa mock: only the login-ticket helpers exercised by the replay
// path. The route returns before touching any other MFA helper.
vi.mock('../auth/mfa', () => ({
  findLoginTicket: mockFindLoginTicket,
  isLoginTicketUsable: (t: { used_at: string | null; expires_at: string } | null) =>
    !!t && !t.used_at && new Date(t.expires_at) >= new Date(),
}));

const env = makeEnv();
const ctx = makePassThroughContext();

function riskCalls(kind: string) {
  return mockLogRiskEvent.mock.calls.filter((c) => c[2]?.kind === kind).map((c) => c[2]);
}

describe('risk events (ADR-234 item 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeviceFingerprint.mockResolvedValue('device-hash');
    mockCheckRateLimitDO.mockResolvedValue({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 });
  });

  describe('loginLocked', () => {
    it('admin /login emits loginLocked when the account is locked', async () => {
      mockCreateAdminSession.mockResolvedValue({ ok: false, status: 401, error: 'Invalid credentials' });
      mockGetAccountByEmail.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        disabled_at: '2026-01-01T00:00:00.000Z',
        compromised_at: null,
      });
      mockAccountIsLocked.mockReturnValue(true);

      const res = await app.fetch(new Request('http://localhost/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com', password: 'wrong' }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(res.status).toBe(401);
      const call = riskCalls('risk_login_locked')[0];
      expect(call).toBeDefined();
      expect(call.payload).toMatchObject({ account: 'admin@example.com' });
      expect(call.payload.ipHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('admin /login does not emit loginLocked when the account is not locked', async () => {
      mockCreateAdminSession.mockResolvedValue({ ok: false, status: 401, error: 'Invalid credentials' });
      mockGetAccountByEmail.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@example.com',
        disabled_at: null,
        compromised_at: null,
      });
      mockAccountIsLocked.mockReturnValue(false);

      await app.fetch(new Request('http://localhost/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@example.com', password: 'wrong' }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(riskCalls('risk_login_locked')).toHaveLength(0);
    });

    it('reader /request emits loginLocked on 423 ACCOUNT_LOCKED', async () => {
      const resetAt = Date.now() + 900_000;
      mockCheckRateLimitDO
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }) // ip middleware
        .mockResolvedValueOnce({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 }) // auth_access
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt });                    // auth_lockout blocked

      const res = await app.fetch(new Request('http://localhost/api/access/request', {
        method: 'POST',
        body: JSON.stringify({ bookSlug: 'book-1', email: 'user@example.com', password: 'pw' }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(res.status).toBe(423);
      const call = riskCalls('risk_login_locked')[0];
      expect(call).toBeDefined();
      expect(call.payload).toMatchObject({ account: 'user@example.com' });
      expect(call.payload.ipHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('token replay', () => {
    it('admin /recovery-verify emits tokenReplay password_reset on reset reason "used"', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'used' });

      const res = await app.fetch(new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 'reused-token',
          newPassword: 'Str0ng-Pass!',
          newPasswordConfirm: 'Str0ng-Pass!',
        }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(res.status).toBe(401);
      expect(riskCalls('risk_token_replay')[0].payload).toMatchObject({
        kind: 'password_reset',
      });
    });

    it('admin /recovery-verify does not emit tokenReplay on a non-`used` failure', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'invalid' });

      await app.fetch(new Request('http://localhost/api/admin/recovery-verify', {
        method: 'POST',
        body: JSON.stringify({
          token: 't',
          newPassword: 'Str0ng-Pass!',
          newPasswordConfirm: 'Str0ng-Pass!',
        }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(riskCalls('risk_token_replay')).toHaveLength(0);
    });

    it('reader /verify-recovery emits tokenReplay password_reset on reset reason "used"', async () => {
      mockVerifyResetToken.mockResolvedValue({ ok: false, reason: 'used' });

      const res = await app.fetch(new Request('http://localhost/api/access/verify-recovery', {
        method: 'POST',
        body: JSON.stringify({ token: 'reused-token' }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(res.status).toBe(401);
      expect(riskCalls('risk_token_replay')[0].payload).toMatchObject({
        kind: 'password_reset',
      });
    });

    it('/login/mfa/verify emits tokenReplay login_ticket on an already-consumed ticket', async () => {
      mockFindLoginTicket.mockResolvedValue({
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 300_000).toISOString(),
        used_at: '2026-01-01T00:00:00.000Z',
      });

      const res = await app.fetch(new Request('http://localhost/api/admin/login/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({
          loginTicket: 'ticket-1',
          authenticationResponse: { id: 'cred-1', response: { clientDataJSON: 'Y2g' } },
        }),
        headers: { 'Content-Type': 'application/json' },
      }), env, ctx);

      expect(res.status).toBe(401);
      expect(riskCalls('risk_token_replay')[0].payload).toMatchObject({
        kind: 'login_ticket',
      });
    });
  });
});
