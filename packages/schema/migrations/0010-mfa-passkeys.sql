-- Migration: 0010-mfa-passkeys
-- Description: WebAuthn passkey credentials + in-flight ceremony challenges
-- for admin accounts (ADR-234 items 5+6).
-- Created: 2026-08-13

-- =============================================================================
-- Passkey (WebAuthn) credentials for admin accounts.
-- credential_id / public_key are stored base64url-encoded (as returned by
-- SimpleWebAuthn) so they round-trip losslessly into verify* calls.
-- =============================================================================
CREATE TABLE IF NOT EXISTS passkey_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    credential_device_type TEXT,
    credential_backed_up INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    aaguid TEXT,
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);

-- =============================================================================
-- In-flight WebAuthn ceremony challenges (single-use, short expiry).
-- id is the base64url challenge string; raw_challenge mirrors it so the verify
-- path can re-assert the exact expected challenge. consumeChallenge marks
-- used_at atomically (single-use + expiry enforced in one UPDATE).
-- =============================================================================
CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK(purpose IN ('registration','authentication')),
    raw_challenge TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenge_user ON webauthn_challenges(user_id);
-- NOTE: no index on expires_at. The ceremony-start prune DELETE
-- (`WHERE datetime(expires_at) < datetime('now') OR used_at IS NOT NULL`)
-- wraps expires_at in datetime() and ORs used_at, so no single-column index
-- can back it; rows are short-lived so the bounded scan is acceptable. A raw
-- expires_at index would be dead weight on writes.
