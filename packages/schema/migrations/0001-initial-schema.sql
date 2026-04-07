-- Migration: 0001-initial-schema
-- Description: Core tables for do EPUB Studio
-- Created: 2026-04-07

-- Users table (simplified, email-based identification)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    global_role TEXT NOT NULL DEFAULT 'reader' CHECK(global_role IN ('admin', 'editor', 'reader')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author_name TEXT,
    description TEXT,
    language TEXT DEFAULT 'en',
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'password_protected', 'reader_only', 'editorial_review', 'public')),
    cover_image_url TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
CREATE INDEX IF NOT EXISTS idx_books_visibility ON books(visibility);

-- Book files table (references R2 storage)
CREATE TABLE IF NOT EXISTS book_files (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'r2' CHECK(storage_provider IN ('r2', 'local')),
    storage_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/epub+zip',
    file_size_bytes INTEGER NOT NULL,
    sha256 TEXT,
    epub_version TEXT,
    manifest_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_book_files_book_id ON book_files(book_id);

-- Book access grants
CREATE TABLE IF NOT EXISTS book_access_grants (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    mode TEXT NOT NULL DEFAULT 'private' CHECK(mode IN ('private', 'password_protected', 'reader_only', 'editorial_review', 'public')),
    allowed INTEGER NOT NULL DEFAULT 1,
    comments_allowed INTEGER NOT NULL DEFAULT 0,
    offline_allowed INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    invited_by_user_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grants_book_email ON book_access_grants(book_id, email);
CREATE INDEX IF NOT EXISTS idx_grants_email ON book_access_grants(email);

-- Reader sessions
CREATE TABLE IF NOT EXISTS reader_sessions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    email TEXT NOT NULL,
    session_token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON reader_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_book_email ON reader_sessions(book_id, email);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON reader_sessions(expires_at);

-- Reading progress
CREATE TABLE IF NOT EXISTS reading_progress (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    locator_json TEXT NOT NULL,
    progress_percent REAL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(book_id, user_email),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_book_user ON reading_progress(book_id, user_email);

-- Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    locator_json TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_book_user ON bookmarks(book_id, user_email);

-- Highlights
CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    chapter_ref TEXT,
    cfi_range TEXT,
    selected_text TEXT NOT NULL,
    note TEXT,
    color TEXT DEFAULT 'yellow',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_highlights_book_user ON highlights(book_id, user_email);

-- Comments (threaded)
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    chapter_ref TEXT,
    cfi_range TEXT,
    selected_text TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'deleted')),
    visibility TEXT NOT NULL DEFAULT 'shared' CHECK(visibility IN ('shared', 'internal', 'resolved')),
    parent_comment_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('book', 'grant', 'session', 'comment', 'user', 'bookmark', 'highlight')),
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Sync state for offline support
CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('create', 'update', 'delete')),
    payload_json TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    sync_attempts INTEGER NOT NULL DEFAULT 0,
    last_sync_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed', 'conflict')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sync_state_user ON sync_state(user_email);
CREATE INDEX IF NOT EXISTS idx_sync_state_status ON sync_state(status);
CREATE INDEX IF NOT EXISTS idx_sync_state_idempotency ON sync_state(idempotency_key);
