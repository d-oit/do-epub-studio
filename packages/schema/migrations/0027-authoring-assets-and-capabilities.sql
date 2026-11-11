-- Migration: 0027-authoring-assets-and-capabilities
-- Description: Add book-scoped author capability and bounded local author assets
-- Created: 2026-11-08

ALTER TABLE book_access_grants
  ADD COLUMN authoring_allowed INTEGER NOT NULL DEFAULT 0
  CHECK (authoring_allowed IN (0, 1));

CREATE TABLE book_invitations_new (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('reader', 'creator', 'author')),
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

INSERT INTO book_invitations_new (
  id, book_id, email, role, token_hash, status, delivery_status,
  delivery_attempted_at, delivery_error_code, user_id, grant_id, grant_mode,
  comments_allowed, offline_allowed, grant_expires_at, expires_at,
  created_by_user_id, created_at, updated_at, accepted_at, revoked_at
)
SELECT
  id, book_id, email, role, token_hash, status, delivery_status,
  delivery_attempted_at, delivery_error_code, user_id, grant_id, grant_mode,
  comments_allowed, offline_allowed, grant_expires_at, expires_at,
  created_by_user_id, created_at, updated_at, accepted_at, revoked_at
FROM book_invitations;

DROP TABLE book_invitations;
ALTER TABLE book_invitations_new RENAME TO book_invitations;

CREATE UNIQUE INDEX idx_book_invitations_pending_email
  ON book_invitations(book_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX idx_book_invitations_book
  ON book_invitations(book_id, created_at DESC);

CREATE INDEX idx_book_invitations_expiry
  ON book_invitations(status, expires_at);

CREATE TABLE author_assets (
  id TEXT NOT NULL,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  media_type TEXT NOT NULL CHECK(media_type IN ('image/jpeg', 'image/png', 'image/gif', 'text/css')),
  sha256 TEXT NOT NULL CHECK(length(sha256) = 64),
  size_bytes INTEGER NOT NULL CHECK (
    (media_type = 'text/css' AND size_bytes BETWEEN 1 AND 65536) OR
    (media_type IN ('image/jpeg', 'image/png', 'image/gif') AND size_bytes BETWEEN 1 AND 5242880)
  ),
  storage_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(book_id, id)
);

CREATE INDEX idx_author_assets_book ON author_assets(book_id, created_at, id);
