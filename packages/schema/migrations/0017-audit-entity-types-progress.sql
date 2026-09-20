-- Migration: 0017-audit-entity-types-progress
-- Description: Extend audit_log.entity_type with 'progress'. Reading progress
-- rows are read through `parseLocatorRow`, which audit-logs a corrupt locator
-- with the entity type of the row it belongs to — so the progress path writes
-- 'progress'. That value was missing from the type union and therefore from
-- migration 0016's CHECK, and because the route passes `c.executionCtx` the
-- failed write surfaced as an unhandled rejection and was dropped silently.
-- The canonical list now lives in `EntityTypeSchema`
-- (packages/schema/src/schemas/common.ts) and the Worker derives its union from
-- it; this migration keeps the CHECK constraint in step. SQLite cannot alter a
-- CHECK constraint in place, so the table is rebuilt.
-- Created: 2026-09-20

CREATE TABLE audit_log_v2 (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    entity_type TEXT NOT NULL CHECK(entity_type IN (
        'book', 'grant', 'session', 'comment', 'user', 'bookmark', 'highlight',
        'progress', 'editorial-feedback', 'editorial-feedback-export',
        'book-creator', 'book-reference', 'style-profile'
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
