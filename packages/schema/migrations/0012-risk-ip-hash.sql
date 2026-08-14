-- Migration: 0012-risk-ip-hash
-- Description: Add per-session client fingerprint columns to admin_sessions so
-- ADR-234 item 7 can observe a suspicious device/IP change on session mint (a
-- new admin session that matches neither the device fingerprint nor the IP of
-- any prior active session is flagged as a risk event). Observational only.
-- Created: 2026-08-14
ALTER TABLE admin_sessions ADD COLUMN ip_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_active_user ON admin_sessions(user_id, revoked_at) WHERE revoked_at IS NULL;
