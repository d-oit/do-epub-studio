-- Migration: 0009-account-auth-lifecycle
-- Description: Account auth lifecycle (ADR-231), password reset token
-- governance (ADR-232), demo account sandbox support (ADR-233), and
-- session/admin auth hardening (ADR-234).
-- Created: 2026-08-13

-- =============================================================================
-- ADR-231: users lifecycle + credential metadata (canonical account identity)
-- =============================================================================
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN disabled_at TEXT;
ALTER TABLE users ADD COLUMN compromised_at TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN last_password_change_at TEXT;
ALTER TABLE users ADD COLUMN password_version INTEGER NOT NULL DEFAULT 1;

-- ADR-234: MFA-ready metadata + hashed recovery codes (JSON array of hashes)
ALTER TABLE users ADD COLUMN mfa_method TEXT;
ALTER TABLE users ADD COLUMN mfa_enrolled_at TEXT;
ALTER TABLE users ADD COLUMN recovery_codes_hash_json TEXT;

-- ADR-233: mark demo accounts (visually identifiable in admin audit, never
-- credentials-bearing in production). Default 0 for non-demo accounts.
ALTER TABLE users ADD COLUMN created_by_demo INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- ADR-234: admin session assurance (step-up), rotation + device label
-- =============================================================================
-- assurance_level: 'none' | 'password' | 'step_up' | 'mfa'
ALTER TABLE admin_sessions ADD COLUMN assurance_level TEXT NOT NULL DEFAULT 'none';
ALTER TABLE admin_sessions ADD COLUMN rotated_from TEXT;
ALTER TABLE admin_sessions ADD COLUMN device_label_hash TEXT;
ALTER TABLE admin_sessions ADD COLUMN step_up_at TEXT;

-- =============================================================================
-- ADR-232: password reset / magic-link token governance.
-- Single-use, CSPRNG-issued, stored only as a SHA-256 hash, with expiry,
-- attempt limits, IP hash + trace for deny-path auditing.
-- =============================================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY,
    email TEXT,
    user_id TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL CHECK(purpose IN ('admin_reset', 'reader_reset', 'reader_magic_link')),
    expires_at TEXT NOT NULL,
    used_at TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    requested_ip_hash TEXT,
    request_trace_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK ((user_id IS NOT NULL) OR (email IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- =============================================================================
-- ADR-231: phased nullable user_id backfill target on reader-owned tables.
-- Columns are nullable to remain backward compatible while data is backfilled
-- from lowercase email. Existing reader flows keyed by user_email still work.
-- =============================================================================
ALTER TABLE reader_sessions ADD COLUMN user_id TEXT;
ALTER TABLE reading_progress ADD COLUMN user_id TEXT;
ALTER TABLE bookmarks ADD COLUMN user_id TEXT;
ALTER TABLE highlights ADD COLUMN user_id TEXT;
ALTER TABLE comments ADD COLUMN user_id TEXT;
ALTER TABLE reading_insights ADD COLUMN user_id TEXT;
ALTER TABLE notifications ADD COLUMN user_id TEXT;
ALTER TABLE sync_state ADD COLUMN user_id TEXT;
