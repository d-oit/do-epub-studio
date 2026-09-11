-- Migration: 0014-references-style
-- Description: Wave 3 of the reader-creator loop (GOAP-999, COL-03):
-- book-scoped creator-curated reference collection (style excerpts,
-- glossary, character/fact/chronology notes, external citations) and a
-- per-book style profile. External citations are born unverified. Feedback
-- gains an anchor_state (computed at read time, stored default only) and a
-- reference_revisions pin captured when feedback is created.
-- Created: 2026-09-11

CREATE TABLE IF NOT EXISTS book_references (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('style_excerpt', 'glossary_term', 'character_note', 'fact_note', 'chronology_note', 'external_citation')),
  title TEXT,
  content TEXT NOT NULL,
  attribution TEXT,
  source_url TEXT,
  origin TEXT NOT NULL CHECK(origin IN ('book', 'creator', 'external')),
  verified INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_references_book ON book_references(book_id);
CREATE INDEX IF NOT EXISTS idx_references_kind ON book_references(book_id, kind);

CREATE TABLE IF NOT EXISTS style_profile (
  book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  language TEXT,
  narrative_person TEXT,
  tense TEXT,
  dialogue_conventions TEXT,
  dialect_notes TEXT,
  terminology TEXT,
  intentional_exceptions TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved')),
  approved_by TEXT,
  approved_at TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE editorial_feedback ADD COLUMN reference_revisions TEXT;
ALTER TABLE editorial_feedback ADD COLUMN anchor_state TEXT NOT NULL DEFAULT 'unresolved' CHECK(anchor_state IN ('unresolved', 'resolved', 'source_changed'));
