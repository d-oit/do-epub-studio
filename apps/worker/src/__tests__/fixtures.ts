import { vi, type Mock } from 'vitest';
import type { Env } from '../lib/env';
import type { RateLimiterDO } from '../lib/rate-limiter-do';
import type { AuthContext } from '../auth/middleware';

// ---------------------------------------------------------------------------
// Mock all Worker modules - shared across all route tests
// ---------------------------------------------------------------------------

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../auth/middleware', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('../auth/middleware')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    validateSession: vi.fn(),
  };
});

vi.mock('../auth/admin-middleware', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('../auth/admin-middleware')>();
  return {
    ...actual,
    requireAdminAuth: vi.fn(),
    createAdminSession: vi.fn(),
    revokeAdminSession: vi.fn(),
    generateAdminToken: vi.fn(),
    hashToken: vi.fn(),
    revokeAllAdminSessionsForUser: vi.fn(),
    revokeAllReaderSessionsForUser: vi.fn(),
    revokeAllReaderSessionsForEmail: vi.fn(),
    raiseAdminAssurance: vi.fn(),
    listAdminSessionsForUser: vi.fn(),
  };
});

vi.mock('../auth/reset', () => ({
  createResetToken: vi.fn(),
  verifyResetToken: vi.fn(),
  bumpResetTokenAttempt: vi.fn(),
  claimResetToken: vi.fn(),
  revokeTokensForAccount: vi.fn(),
  purgeExpiredTokensForAccount: vi.fn(),
}));

vi.mock('../auth/account', () => ({
  getAccountByEmail: vi.fn(),
  getAccountById: vi.fn(),
  accountIsLocked: vi.fn(),
  isPasswordDerivative: vi.fn(),
  verifyAccountPassword: vi.fn(),
  changePassword: vi.fn(),
  changePasswordAndConsumeResetToken: vi.fn(),
  setAccountDisabled: vi.fn(),
  markEmailVerified: vi.fn(),
  updateLastLogin: vi.fn(),
}));

vi.mock('../auth/password', () => ({
  validateGrant: vi.fn(),
  computeCapabilities: vi.fn(),
  getGrantByBookAndSession: vi.fn(),
  getGrantsBySession: vi.fn(),
  createGrant: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  revokeGrant: vi.fn(),
}));

vi.mock('../auth/session', () => ({
  createSession: vi.fn(),
  validateSession: vi.fn(),
  revokeSession: vi.fn(),
  parseAuthHeader: vi.fn((h) => h?.replace('Bearer ', '')),
}));

vi.mock('../storage/signed-url', () => ({
  generateSignedUrl: vi.fn(),
  verifySignedUrlExpiry: vi.fn(),
  verifySignedUrlSignature: vi.fn(),
}));

vi.mock('../audit', () => ({
  logAudit: vi.fn(),
  sanitizeAuditPayload: vi.fn((payload: Record<string, unknown>) => payload),
}));

// ---------------------------------------------------------------------------
// Import mocked modules for reference
// ---------------------------------------------------------------------------

import { queryFirst, queryAll, execute, transaction } from '../db/client';
import { requireAuth } from '../auth/middleware';
import {
  requireAdminAuth,
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessionsForUser,
  revokeAllReaderSessionsForEmail,
  raiseAdminAssurance,
  listAdminSessionsForUser,
  hashToken as _hashAdminToken,
} from '../auth/admin-middleware';
import {
  validateGrant,
  computeCapabilities,
  createGrant as createGrantMod,
  getGrantByBookAndSession,
  getGrantsBySession,
} from '../auth/password';
import {
  createSession,
  validateSession as validateSessionMod,
  revokeSession,
} from '../auth/session';
import { generateSignedUrl } from '../storage/signed-url';
import { logAudit } from '../audit';
import * as resetMod from '../auth/reset';
import * as accountMod from '../auth/account';

// ---------------------------------------------------------------------------
// Mocked function references - exported as Mocks
// ---------------------------------------------------------------------------

export const mockQueryFirst = queryFirst as Mock;
export const mockQueryAll = queryAll as Mock;
export const mockExecute = execute as Mock;
export const mockTransaction = transaction as Mock;
export const mockRequireAuth = requireAuth as Mock;
export const mockRequireAdminAuth = requireAdminAuth as Mock;
export const mockCreateAdminSession = createAdminSession as Mock;
export const mockRevokeAdminSession = revokeAdminSession as Mock;
export const mockRevokeAllAdminSessionsForUser = revokeAllAdminSessionsForUser as Mock;
export const mockRevokeAllReaderSessionsForEmail = revokeAllReaderSessionsForEmail as Mock;
export const mockRaiseAdminAssurance = raiseAdminAssurance as Mock;
export const mockListAdminSessionsForUser = listAdminSessionsForUser as Mock;
export const mockHashAdminToken = _hashAdminToken as Mock;
export const mockValidateGrant = validateGrant as Mock;
export const mockComputeCapabilities = computeCapabilities as Mock;
export const mockCreateGrant = createGrantMod as Mock;
export const mockGetGrantByBookAndSession = getGrantByBookAndSession as Mock;
export const mockGetGrantsBySession = getGrantsBySession as Mock;
export const mockCreateSession = createSession as Mock;
export const mockValidateSessionMod = validateSessionMod as Mock;
export const mockRevokeSession = revokeSession as Mock;
export const mockGenerateSignedUrl = generateSignedUrl as Mock;
export const mockLogAudit = logAudit as Mock;
export const mockCreateResetToken = (resetMod.createResetToken as Mock);
export const mockVerifyResetToken = (resetMod.verifyResetToken as Mock);
export const mockBumpResetTokenAttempt = (resetMod.bumpResetTokenAttempt as Mock);
export const mockClaimResetToken = (resetMod.claimResetToken as Mock);
export const mockGetAccountByEmail = (accountMod.getAccountByEmail as Mock);
export const mockAccountIsLocked = (accountMod.accountIsLocked as Mock);
export const mockIsPasswordDerivative = (accountMod.isPasswordDerivative as Mock);
export const mockVerifyAccountPassword = (accountMod.verifyAccountPassword as Mock);
export const mockChangePassword = (accountMod.changePassword as Mock);
export const mockChangePasswordAndConsumeResetToken = (accountMod.changePasswordAndConsumeResetToken as Mock);

// ---------------------------------------------------------------------------
// Test helper functions
// ---------------------------------------------------------------------------

export function makeEnv(): Env {
  const mockDB = {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({}),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({}),
  };
  return {
    BOOKS_BUCKET: makeMockBucket(),
    DB: mockDB as unknown as D1Database,
    SENDER_EMAIL: {} as unknown as SendEmail,
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
    } as unknown as KVNamespace,
    TURSO_DATABASE_URL: 'file::memory:',
    TURSO_AUTH_TOKEN: 'test-token',
    SESSION_SIGNING_SECRET: process.env.TEST_SESSION_SIGNING_SECRET || 'test-secret',
    INVITE_TOKEN_SECRET: process.env.TEST_INVITE_TOKEN_SECRET || 'test-invite-secret',
    APP_BASE_URL: 'https://test.example.com',
    RATE_LIMITER: {
      idFromName: vi.fn().mockReturnValue({ toString: () => 'mock-id' }),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ allowed: true, remaining: 99, resetAt: Date.now() + 60000 }),
        }),
      }),
    } as unknown as DurableObjectNamespace<RateLimiterDO>,
  };
}

function makeMockBucket(): R2Bucket {
  return {
    get: () => Promise.resolve(null),
    put: (() => Promise.resolve(null)) as unknown as R2Bucket['put'],
    head: () => Promise.resolve(null),
    createMultipartUpload: () => Promise.resolve({} as R2MultipartUpload),
    resumeMultipartUpload: () => ({}) as R2MultipartUpload,
    delete: () => Promise.resolve(undefined),
    list: () =>
      Promise.resolve({ objects: [], truncated: false, delimitedPrefixes: [] }),
  };
}

export function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {  return {
    sessionId: 'session-1',
    email: 'user@example.com',
    bookId: 'book-1',
    capabilities: {
      canRead: true,
      canComment: true,
      canHighlight: true,
      canBookmark: true,
      canDownloadOffline: true,
      canExportNotes: true,
      canManageAccess: false,
    },
    ...overrides,
  };
}

/**
 * Arm a single `queryFirst` call to resolve as an elevated admin session for
 * `requireStepUp`. Call after setting up `requireAdminAuth` and BEFORE seeding
 * any handler-level DB rows, because the step-up lookups runs first.
 */
export const mockStepUpAssured = () =>
  mockQueryFirst.mockResolvedValueOnce({ assurance_level: 'step_up' });

// Typed passthrough ExecutionContext for route tests — replaces `{ waitUntil: () => {} } as any`
// patterns flagged by Codacy as ESLint8_@typescript-eslint_no-explicit-any.
export function makePassThroughContext(): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
    abort: () => {},
    props: {},
    exports: {},
    tracing: {} as Tracing,
  };
}

/** Parse a fetch Response JSON body with known API shape. Avoids `as` cast at each call site. */
export async function parseBody(res: Response): Promise<{ ok: boolean; data: Record<string, unknown>; error?: { code: string } }> {
  const json: unknown = await res.json();
  return json as { ok: boolean; data: Record<string, unknown>; error?: { code: string } };
}
