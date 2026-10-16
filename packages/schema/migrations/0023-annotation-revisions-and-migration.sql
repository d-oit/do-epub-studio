-- Migration: 0023-annotation-revisions-and-migration
-- Description: Track revision identity, anchor status, and migration outcomes for annotations
-- Created: 2026-10-15

ALTER TABLE comments ADD COLUMN revision_id TEXT;
ALTER TABLE comments ADD COLUMN original_cfi TEXT;
ALTER TABLE comments ADD COLUMN original_chapter_ref TEXT;
ALTER TABLE comments ADD COLUMN original_selected_text TEXT;
ALTER TABLE comments ADD COLUMN anchor_status TEXT NOT NULL DEFAULT 'anchored';
ALTER TABLE comments ADD COLUMN confidence REAL DEFAULT 1.0;
ALTER TABLE comments ADD COLUMN migration_outcome TEXT;

ALTER TABLE highlights ADD COLUMN revision_id TEXT;
ALTER TABLE highlights ADD COLUMN original_cfi TEXT;
ALTER TABLE highlights ADD COLUMN original_chapter_ref TEXT;
ALTER TABLE highlights ADD COLUMN original_selected_text TEXT;
ALTER TABLE highlights ADD COLUMN anchor_status TEXT NOT NULL DEFAULT 'anchored';
ALTER TABLE highlights ADD COLUMN confidence REAL DEFAULT 1.0;
ALTER TABLE highlights ADD COLUMN migration_outcome TEXT;

CREATE INDEX IF NOT EXISTS idx_comments_anchor_status ON comments(book_id, anchor_status);
CREATE INDEX IF NOT EXISTS idx_highlights_anchor_status ON highlights(book_id, anchor_status);
CREATE INDEX IF NOT EXISTS idx_comments_revision_id ON comments(revision_id);
CREATE INDEX IF NOT EXISTS idx_highlights_revision_id ON highlights(revision_id);

CREATE TABLE IF NOT EXISTS annotation_migrations (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    source_revision_id TEXT,
    target_revision_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    total_count INTEGER NOT NULL DEFAULT 0,
    migrated_count INTEGER NOT NULL DEFAULT 0,
    orphaned_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_annotation_migrations_book ON annotation_migrations(book_id, target_revision_id);
