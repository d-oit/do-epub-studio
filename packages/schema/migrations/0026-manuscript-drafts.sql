-- Migration: 0026-manuscript-drafts
-- Description: Store mutable author manuscript drafts with optimistic concurrency versioning
-- Created: 2026-11-05

CREATE TABLE IF NOT EXISTS book_manuscript_drafts (
  book_id TEXT PRIMARY KEY,
  publication_json TEXT NOT NULL CHECK (length(publication_json) <= 5000000),
  draft_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_book_manuscript_drafts_updated ON book_manuscript_drafts(updated_at);
