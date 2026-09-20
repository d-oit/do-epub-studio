-- Migration: 0016-audit-entity-types
-- Description: Extend the audit_log.entity_type CHECK constraint to the entity
-- types the Worker actually writes. Migrations 0013-0015 added the collaboration
-- records (editorial feedback, book-scoped creators, references, style profiles)
-- and their routes log audit entries, but the original 0001 constraint was never
-- widened: every such audit write failed with SQLITE_CONSTRAINT. Because the
-- routes pass `c.executionCtx`, the failure surfaced as an unhandled rejection
-- and the audit entry was silently dropped (GOAP-999 Wave 2 verification).
-- SQLite cannot alter a CHECK constraint in place, so the table is rebuilt.
-- Created: 2026-09-20

CREATE TABLE audit_log_v2 (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    entity_type TEXT NOT NULL CHECK(entity_type IN (
        'book', 'grant', 'session', 'comment', 'user', 'bookmark', 'highlight',
        'editorial-feedback', 'editorial-feedback-export', 'book-creator',
        'book-reference', 'style-profile'
    )),
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO audit_log_v2 (id, actor_email, entity_type, entity_id, action, payload_json, created_at)
    SELECT id, actor_email, entity_type, entity_id, action, payload_json, created_at FROM audit_log;

DROP TABLE audit_log;

ALTER TABLE audit_log_v2 RENAME TO audit_log;

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
