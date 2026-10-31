-- Migration: 0024-epub-conformance-reports
-- Description: Store bounded revision-scoped EPUBCheck and accessibility report state
-- Created: 2026-10-31

CREATE TABLE IF NOT EXISTS epub_validation_reports (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  bytes_sha256 TEXT,
  validator_version TEXT NOT NULL DEFAULT '5.4.0',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  safety_status TEXT NOT NULL DEFAULT 'pending' CHECK (safety_status IN ('pending', 'accepted', 'rejected', 'failed')),
  epub_version TEXT,
  findings_json TEXT NOT NULL DEFAULT '[]' CHECK (length(findings_json) <= 262144),
  accessibility_json TEXT NOT NULL DEFAULT '{}' CHECK (length(accessibility_json) <= 65536),
  failure_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 100),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (revision_id, bytes_sha256, validator_version)
);

CREATE INDEX IF NOT EXISTS idx_epub_reports_revision ON epub_validation_reports(revision_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_epub_reports_book ON epub_validation_reports(book_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS epub_accessibility_remediation (
  revision_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL DEFAULT '{}' CHECK (length(state_json) <= 65536),
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
