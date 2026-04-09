-- Migration: 0002-admin-auth
-- Description: Add admin sessions table and password_hash to users
-- Created: 2026-04-09

-- Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Admin sessions table for tracking admin authentication
CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(user_id, revoked_at) WHERE revoked_at IS NULL;
