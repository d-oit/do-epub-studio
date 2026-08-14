import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuditQuerySchema } from '@do-epub-studio/schema';

vi.mock('../audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../audit')>();
  return { ...actual, logAudit: vi.fn() };
});

import { logRiskEvent, deviceFingerprint, RISK_EVENTS } from '../audit/risk';
import { logAudit, sanitizeAuditPayload } from '../audit';

const mockLogAudit = logAudit as ReturnType<typeof vi.fn>;

const env = {} as Parameters<typeof logRiskEvent>[0];
const ctx = { waitUntil: () => {} };

describe('audit/risk', () => {
  describe('RISK_EVENTS', () => {
    it('exposes the canonical risk event actions', () => {
      expect(RISK_EVENTS).toEqual({
        tokenReplay: 'risk_token_replay',
        loginLocked: 'risk_login_locked',
        suspiciousDeviceChange: 'risk_suspicious_device_change',
      });
    });
  });

  describe('logRiskEvent', () => {
    beforeEach(() => {
      mockLogAudit.mockClear();
    });

    it('turns kind into the action and merges facility: risk into the payload', async () => {
      await logRiskEvent(env, ctx, {
        kind: RISK_EVENTS.tokenReplay,
        actorEmail: 'a@example.com',
        entityId: 'user-1',
        entityType: 'user',
        payload: { kind: 'password_reset', ipHash: 'abc123' },
      });

      expect(mockLogAudit).toHaveBeenCalledTimes(1);
      const entry = mockLogAudit.mock.calls[0][1];
      expect(entry.action).toBe('risk_token_replay');
      expect(entry.entityType).toBe('user');
      expect(entry.entityId).toBe('user-1');
      expect(entry.actorEmail).toBe('a@example.com');
      expect(entry.payload).toMatchObject({
        facility: 'risk',
        kind: 'password_reset',
        ipHash: 'abc123',
      });
    });

    it('defaults entityType to user and works without an execution context', async () => {
      await logRiskEvent(env, undefined, {
        kind: RISK_EVENTS.loginLocked,
        entityId: 'acct',
        payload: { account: 'a@example.com' },
      });
      const entry = mockLogAudit.mock.calls[0][1];
      expect(entry.entityType).toBe('user');
      expect(entry.action).toBe('risk_login_locked');
    });
  });

  describe('sanitizeAuditPayload (leak prevention)', () => {
    it('redacts tokens, passwords, secrets and API keys', () => {
      const out = sanitizeAuditPayload({
        token: 'secret-token',
        password: 'hunter2',
        apikey: 'abc-123',
        account: 'a@example.com',
        ipHash: 'deadbeef',
        priorSessionCount: 2,
      });
      expect(out.token).toBe('[REDACTED]');
      expect(out.password).toBe('[REDACTED]');
      expect(out.apikey).toBe('[REDACTED]');
      // Non-sensitive fields pass through.
      expect(out.account).toBe('a@example.com');
      expect(out.ipHash).toBe('deadbeef');
      expect(out.priorSessionCount).toBe(2);
    });
  });

  describe('deviceFingerprint', () => {
    it('returns a stable 64-char SHA-256 hex', async () => {
      const a = await deviceFingerprint('Mozilla/5.0 test');
      const b = await deviceFingerprint('Mozilla/5.0 test');
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });

    it('is deterministic for undefined (empty) user agents', async () => {
      const a = await deviceFingerprint(undefined);
      const b = await deviceFingerprint('');
      expect(a).toBe(b);
    });
  });

  describe('AuditQuerySchema.action (ADR-234 item 7 query surface)', () => {
    it('accepts an action query and passes it through', () => {
      const parsed = AuditQuerySchema.parse({
        action: 'risk_login_locked',
        limit: 10,
      });
      expect(parsed.action).toBe('risk_login_locked');
    });

    it('leaves action undefined when omitted', () => {
      const parsed = AuditQuerySchema.parse({ limit: 10 });
      expect(parsed.action).toBeUndefined();
    });
  });

  describe('migration 0012 (ADR-234 item 7)', () => {
    it('exists and matches the 0011 file format', () => {
      const p = join(__dirname, '../../../../packages/schema/migrations/0012-risk-ip-hash.sql');
      const sql = readFileSync(p, 'utf8');
      expect(sql).toMatch(/^-- Migration: 0012-risk-ip-hash/m);
      expect(sql).toContain('ALTER TABLE admin_sessions ADD COLUMN ip_hash TEXT;');
      // Follows 0011's header conventions (Description + Created).
      expect(sql).toMatch(/^-- Description:/m);
      expect(sql).toMatch(/^-- Created:/m);
    });
  });
});
