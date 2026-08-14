import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdminSession, createAdminSessionMfa } from '../auth/admin-middleware';
import * as db from '../db/client';
import * as password from '../auth/password';
import type { Env } from '../lib/env';

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../auth/password', () => ({
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock('../lib/observability', () => ({
  createRequestContext: vi.fn(() => ({})),
  logAppError: vi.fn(),
}));

vi.mock('../audit', () => ({
  logAudit: vi.fn(),
  sanitizeAuditPayload: (payload: Record<string, unknown>) => payload,
}));

import { logAudit } from '../audit';
const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

const env = {} as Env;

const userRow = {
  id: 'user-1',
  email: 'admin@example.com',
  global_role: 'admin' as const,
  password_hash: 'hashed',
  disabled_at: null,
  compromised_at: null,
};

function findRiskCalls(action: string) {
  return mockLogAudit.mock.calls.filter((c) => c[1]?.action === action);
}

describe('admin-middleware suspicious-device-change risk (ADR-234 item 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(password.verifyPassword).mockResolvedValue(true);
    vi.mocked(db.execute).mockResolvedValue({ rows: [] });
  });

  it('persists device_label_hash + ip_hash on the minted session', async () => {
    vi.mocked(db.queryFirst)
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({ mfa_method: null });
    vi.mocked(db.queryAll).mockResolvedValue([]);

    await createAdminSession(env, 'admin@example.com', 'password', {
      deviceLabelHash: 'dev-a',
      ipHash: 'ip-a',
    });

    const insertCall = vi.mocked(db.execute).mock.calls.find(
      (c) => typeof c[1] === 'string' && c[1].includes('INSERT INTO admin_sessions'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[2]).toContain('dev-a');
    expect(insertCall?.[2]).toContain('ip-a');
  });

  it('emits suspicious-device-change when neither device nor IP matches prior active sessions', async () => {
    vi.mocked(db.queryFirst)
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({ mfa_method: null });
    // One prior active session with a different device and IP.
    vi.mocked(db.queryAll).mockResolvedValue([
      { device_label_hash: 'dev-other', ip_hash: 'ip-other' },
    ]);

    const result = await createAdminSession(env, 'admin@example.com', 'password', {
      deviceLabelHash: 'dev-new',
      ipHash: 'ip-new',
    });
    expect(result.ok).toBe(true);

    const calls = findRiskCalls('risk_suspicious_device_change');
    expect(calls).toHaveLength(1);
    const entry = calls[0][1];
    expect(entry.entityId).toBe('user-1');
    expect(entry.payload).toMatchObject({
      facility: 'risk',
      account: 'admin@example.com',
      deviceLabelHash: 'dev-new',
      priorSessionCount: 1,
    });
  });

  it('does NOT emit when a prior active session shares the same device', async () => {
    vi.mocked(db.queryFirst)
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({ mfa_method: null });
    vi.mocked(db.queryAll).mockResolvedValue([
      { device_label_hash: 'dev-new', ip_hash: 'ip-other' },
    ]);

    await createAdminSession(env, 'admin@example.com', 'password', {
      deviceLabelHash: 'dev-new',
      ipHash: 'ip-new',
    });

    expect(findRiskCalls('risk_suspicious_device_change')).toHaveLength(0);
  });

  it('does NOT emit when a prior active session shares the same IP', async () => {
    vi.mocked(db.queryFirst)
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({ mfa_method: null });
    vi.mocked(db.queryAll).mockResolvedValue([
      { device_label_hash: 'dev-other', ip_hash: 'ip-new' },
    ]);

    await createAdminSession(env, 'admin@example.com', 'password', {
      deviceLabelHash: 'dev-new',
      ipHash: 'ip-new',
    });

    expect(findRiskCalls('risk_suspicious_device_change')).toHaveLength(0);
  });

  it('does NOT emit when there are no prior active sessions (first session)', async () => {
    vi.mocked(db.queryFirst)
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({ mfa_method: null });
    vi.mocked(db.queryAll).mockResolvedValue([]);

    await createAdminSession(env, 'admin@example.com', 'password', {
      deviceLabelHash: 'dev-new',
      ipHash: 'ip-new',
    });

    expect(findRiskCalls('risk_suspicious_device_change')).toHaveLength(0);
  });

  it('does NOT emit when no clientHints are provided (backward compatible)', async () => {
    vi.mocked(db.queryFirst)
      .mockResolvedValueOnce(userRow)
      .mockResolvedValueOnce({ mfa_method: null });

    const result = await createAdminSession(env, 'admin@example.com', 'password');
    expect(result.ok).toBe(true);
    expect(db.queryAll).not.toHaveBeenCalled();
    expect(findRiskCalls('risk_suspicious_device_change')).toHaveLength(0);
  });

  it('createAdminSessionMfa emits when both device and IP are novel', async () => {
    vi.mocked(db.queryAll).mockResolvedValue([
      { device_label_hash: 'dev-other', ip_hash: 'ip-other' },
    ]);

    await createAdminSessionMfa(env, { id: 'user-1', email: 'admin@example.com', role: 'admin' }, {
      deviceLabelHash: 'dev-new',
      ipHash: 'ip-new',
    });

    const calls = findRiskCalls('risk_suspicious_device_change');
    expect(calls).toHaveLength(1);
    expect(calls[0][1].payload).toMatchObject({
      facility: 'risk',
      deviceLabelHash: 'dev-new',
      priorSessionCount: 1,
    });
  });
});
