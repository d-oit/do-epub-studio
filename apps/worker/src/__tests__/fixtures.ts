import { vi, type Mock } from 'vitest';
import type { Env, R2Bucket } from '../lib/env';
import type { AuthContext } from '../auth/middleware';

// ---------------------------------------------------------------------------
// Mock all Worker modules - shared across all route tests
// ---------------------------------------------------------------------------

vi.mock('../db/client', () => ({
  queryFirst: vi.fn(),
  queryAll: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('../auth/middleware', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('../auth/middleware')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
    validateSession: vi.fn(),
    generateToken: vi.fn(),
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
  };
});

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

import { queryFirst, queryAll, execute } from '../db/client';
import { requireAuth } from '../auth/middleware';
import { requireAdminAuth, createAdminSession, revokeAdminSession } from '../auth/admin-middleware';
import {
  validateGrant,
  computeCapabilities,
  createGrant as createGrantMod,
  getGrantByBookAndSession,
  getGrantsBySession,
  revokeGrant,
} from '../auth/password';
import {
  createSession,
  validateSession as validateSessionMod,
  revokeSession,
} from '../auth/session';
import {
  generateSignedUrl,
  verifySignedUrlExpiry,
  verifySignedUrlSignature,
} from '../storage/signed-url';
import { logAudit, sanitizeAuditPayload } from '../audit';

// ---------------------------------------------------------------------------
// Mocked function references - exported as Mocks
// ---------------------------------------------------------------------------

export const mockQueryFirst = queryFirst as Mock;
export const mockQueryAll = queryAll as Mock;
export const mockExecute = execute as Mock;
export const mockRequireAuth = requireAuth as Mock;
export const mockRequireAdminAuth = requireAdminAuth as Mock;
export const mockCreateAdminSession = createAdminSession as Mock;
export const mockRevokeAdminSession = revokeAdminSession as Mock;
export const mockValidateGrant = validateGrant as Mock;
export const mockComputeCapabilities = computeCapabilities as Mock;
export const mockCreateGrant = createGrantMod as Mock;
export const mockGetGrantByBookAndSession = getGrantByBookAndSession as Mock;
export const mockGetGrantsBySession = getGrantsBySession as Mock;
export const mockRevokeGrant = revokeGrant as Mock;
export const mockCreateSession = createSession as Mock;
export const mockValidateSessionMod = validateSessionMod as Mock;
export const mockRevokeSession = revokeSession as Mock;
export const mockGenerateSignedUrl = generateSignedUrl as Mock;
export const mockVerifyExpiry = verifySignedUrlExpiry as Mock;
export const mockVerifySignature = verifySignedUrlSignature as Mock;
export const mockLogAudit = logAudit as Mock;
export const mockSanitizeAuditPayload = sanitizeAuditPayload as Mock;

// ---------------------------------------------------------------------------
// Test helper functions
// ---------------------------------------------------------------------------

export function makeEnv(): Env {
  return {
    BOOKS_BUCKET: makeMockBucket(),
    TURSO_DATABASE_URL: process.env.TEST_TURSO_DATABASE_URL || 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: process.env.TEST_TURSO_AUTH_TOKEN || 'test-token',
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
    } as unknown as DurableObjectNamespace,
  };
}

function makeMockBucket(): R2Bucket {
  return {
    get: () => Promise.resolve(null),
    put: () => Promise.resolve(
      null as unknown as R2Bucket extends { put(key: string, value: infer V): Promise<infer R> }
        ? R
        : never,
    ),
    delete: () => Promise.resolve(undefined),
    list: () => Promise.resolve({ objects: [], truncated: false }),
  };
}

export function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://test.example.com/api/test', {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
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

export function makeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'session-1',
    book_id: 'book-1',
    email: 'user@example.com',
    session_token_hash: 'hash',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date().toISOString(),
    revoked_at: null,
    ...overrides,
  };
}

export function makeBookRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'book-1',
    slug: 'test-book',
    title: 'Test Book',
    author_name: 'Test Author',
    description: null,
    language: 'en',
    visibility: 'private',
    cover_image_url: null,
    published_at: null,
    ...overrides,
  };
}

export function makeGrantRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'grant-1',
    book_id: 'book-1',
    email: 'user@example.com',
    password_hash: null,
    mode: 'private',
    allowed: 1,
    comments_allowed: 0,
    offline_allowed: 0,
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

export function makeProgressRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'progress-1',
    book_id: 'book-1',
    user_email: 'user@example.com',
    locator_json: JSON.stringify({ cfi: 'epubcfi(/6/4)', selectedText: 'test' }),
    progress_percent: 50,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeBookmarkRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bookmark-1',
    book_id: 'book-1',
    user_email: 'user@example.com',
    locator_json: JSON.stringify({ cfi: 'epubcfi(/6/4)', selectedText: 'test' }),
    label: 'My Bookmark',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeHighlightRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'highlight-1',
    book_id: 'book-1',
    user_email: 'user@example.com',
    chapter_ref: 'Chapter 1',
    cfi_range: 'epubcfi(/6/4)',
    selected_text: 'Important passage',
    note: null,
    color: '#ffff00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeCommentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'comment-1',
    book_id: 'book-1',
    user_email: 'user@example.com',
    chapter_ref: 'Chapter 1',
    cfi_range: 'epubcfi(/6/4)',
    selected_text: 'Selected text',
    body: 'This is a comment',
    status: 'open',
    visibility: 'shared',
    parent_comment_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resolved_at: null,
    ...overrides,
  };
}

export function makeAuditLogRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'audit-1',
    actor_email: 'admin@example.com',
    entity_type: 'book',
    entity_id: 'book-1',
    action: 'created',
    payload_json: JSON.stringify({ slug: 'test-book' }),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
