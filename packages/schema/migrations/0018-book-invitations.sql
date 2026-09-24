-- Migration: 0018-book-invitations
-- Description: Add the book-scoped invitation lifecycle used by production
-- reader/creator onboarding (ADR-284). The invitation is a pending control-
-- plane record; a grant is not activated until the recipient accepts.
-- Created: 2026-09-24

CREATE TABLE IF NOT EXISTS book_invitations (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('reader', 'creator')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'processing', 'accepted', 'revoked', 'expired', 'failed')),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(delivery_status IN ('pending', 'sent', 'manual_copy_required', 'failed')),
  delivery_attempted_at TEXT,
  delivery_error_code TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  grant_id TEXT REFERENCES book_access_grants(id) ON DELETE SET NULL,
  grant_mode TEXT NOT NULL DEFAULT 'private'
    CHECK(grant_mode IN ('private', 'password_protected', 'reader_only', 'editorial_review', 'public')),
  comments_allowed INTEGER NOT NULL DEFAULT 0,
  offline_allowed INTEGER NOT NULL DEFAULT 0,
  grant_expires_at TEXT,
  expires_at TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_book_invitations_pending_email
  ON book_invitations(book_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_book_invitations_book
  ON book_invitations(book_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_invitations_expiry
  ON book_invitations(status, expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window
  ON rate_limit_buckets(window_started_at);

CREATE TABLE audit_log_v3 (
  id TEXT PRIMARY KEY,
  actor_email TEXT,
  entity_type TEXT NOT NULL CHECK(entity_type IN (
    'book', 'grant', 'session', 'comment', 'user', 'bookmark', 'highlight',
    'progress', 'editorial-feedback', 'editorial-feedback-export',
    'book-creator', 'book-reference', 'style-profile', 'book-invitation'
  )),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO audit_log_v3 (id, actor_email, entity_type, entity_id, action, payload_json, created_at)
  SELECT id, actor_email, entity_type, entity_id, action, payload_json, created_at FROM audit_log;

DROP TABLE audit_log;
ALTER TABLE audit_log_v3 RENAME TO audit_log;

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
