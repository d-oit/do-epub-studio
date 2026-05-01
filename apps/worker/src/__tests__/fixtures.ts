import { vi } from 'vitest';
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

vi.mock('../auth/middleware', () => ({
  requireAuth: vi.fn(),
  validateSession: vi.fn(),
  generateToken: vi.fn(),
}));

vi.mock('../auth/password', () => ({
  validateGrant: vi.fn(),
  computeCapabilities: vi.fn(),
  getGrantByBookAndSession: vi.fn(),
  getGrantsBySession: vi.fn(),
  createGrant: vi.fn(),
}));

vi.mock('../auth/session', () => ({
  createSession: vi.fn(),
  validateSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('../storage/signed-url', () => ({
  generateSignedUrl: vi.fn(),
  verifySignedUrlExpiry: vi.fn(),
  verifySignedUrlSignature: vi.fn(),
}));

vi.mock('../audit', () => ({
  logAudit: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import mocked modules
// ---------------------------------------------------------------------------

import { queryFirst, queryAll, execute } from '../db/client';
import { requireAuth } from '../auth/middleware';
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
import {
  generateSignedUrl,
  verifySignedUrlExpiry,
  verifySignedUrlSignature,
} from '../storage/signed-url';
import { logAudit } from '../audit';

// ---------------------------------------------------------------------------
// Mocked function references
// ---------------------------------------------------------------------------

export const mockQueryFirst = vi.mocked(queryFirst);
export const mockQueryAll = vi.mocked(queryAll);
export const mockExecute = vi.mocked(execute);
export const mockRequireAuth = vi.mocked(requireAuth);
export const mockValidateGrant = vi.mocked(validateGrant);
export const mockComputeCapabilities = vi.mocked(computeCapabilities);
export const mockCreateGrant = vi.mocked(createGrantMod);
export const mockGetGrantByBookAndSession = vi.mocked(getGrantByBookAndSession);
export const mockGetGrantsBySession = vi.mocked(getGrantsBySession);
export const mockCreateSession = vi.mocked(createSession);
export const mockValidateSessionMod = vi.mocked(validateSessionMod);
export const mockRevokeSession = vi.mocked(revokeSession);
export const mockGenerateSignedUrl = vi.mocked(generateSignedUrl);
export const mockVerifyExpiry = vi.mocked(verifySignedUrlExpiry);
export const mockVerifySignature = vi.mocked(verifySignedUrlSignature);
export const mockLogAudit = vi.mocked(logAudit);

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------

export { getGrantByBookAndSession, getGrantsBySession };

// ---------------------------------------------------------------------------
// Test helper functions
// ---------------------------------------------------------------------------

export function makeEnv(): Env {
  return {
    BOOKS_BUCKET: makeMockBucket(),
    TURSO_DATABASE_URL: 'libsql://test.turso.io',
    TURSO_AUTH_TOKEN: 'test-token',
    SESSION_SIGNING_SECRET: 'test-secret',
    INVITE_TOKEN_SECRET: 'test-invite-secret',
    APP_BASE_URL: 'https://test.example.com',
  };
}

// Use R2Bucket from env.ts - mock functions return partial data for testing
function makeMockBucket(): R2Bucket {
  return {
    get: async () => null,
    put: async () =>
      null as unknown as R2Bucket extends { put(key: string, value: infer V): Promise<infer R> }
        ? R
        : never,
    delete: async () => undefined,
    list: async () => ({ objects: [], truncated: false }),
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
