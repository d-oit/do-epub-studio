-- Migration: 0007-fts-search
-- Description: Add FTS5 virtual table for full-text search within book content
-- Created: 2026-07-18

-- FTS5 virtual table for searching within book content
CREATE VIRTUAL TABLE IF NOT EXISTS book_content_fts USING fts5(
    book_id UNINDEXED,
    chapter_ref UNINDEXED,
    content,
    tokenize='porter unicode61'
);

-- Regular table to track which books have been indexed
CREATE TABLE IF NOT EXISTS book_search_index (
    book_id TEXT PRIMARY KEY,
    indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
    chapter_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
