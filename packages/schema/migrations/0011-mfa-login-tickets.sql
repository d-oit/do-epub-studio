-- Migration: 0011-mfa-login-tickets
-- Description: Short-lived, single-use login tickets that bind the passkey
-- second-factor ceremony (/login/mfa/*) to a prior successful password /login.
-- ADR-234 review finding: the public passkey login path must not mint an `mfa`
-- session from a passkey alone — the account password (factor 1) must be
-- proven first. A ticket is issued only after /login verifies the password,
-- then consumed atomically exactly once when the passkey (factor 2) succeeds.
-- Created: 2026-08-14
CREATE TABLE IF NOT EXISTS mfa_login_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mfa_login_ticket_user ON mfa_login_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_login_ticket_active ON mfa_login_tickets(user_id, expires_at) WHERE used_at IS NULL;
