-- Migration: 0025-annotation-interchange
-- Description: Store authorized EPUB Annotations Working Draft profile documents separately from annotation DTOs
-- Created: 2026-10-31

CREATE TABLE IF NOT EXISTS annotation_interchange_documents (
  book_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  document_json TEXT NOT NULL CHECK (length(document_json) <= 1000000),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (book_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_annotation_interchange_book ON annotation_interchange_documents(book_id);
