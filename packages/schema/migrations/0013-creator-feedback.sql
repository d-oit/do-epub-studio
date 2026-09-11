-- Migration: 0013-creator-feedback
-- Description: Book-scoped creator assignments and the private reader-creator
-- editorial feedback channel (GOAP-999 Wave 2, COL-01/COL-02). Existing shared
-- discussion (comments table) is unchanged; this channel is private by design
-- (visibility locked to 'private'). Revocation is a hard delete of the
-- assignment row plus an audit_log entry.
-- Created: 2026-09-11

CREATE TABLE IF NOT EXISTS book_creators (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(book_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_creators_book ON book_creators(book_id);
CREATE INDEX IF NOT EXISTS idx_creators_user ON book_creators(user_id);

CREATE TABLE IF NOT EXISTS editorial_feedback (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  book_file_id TEXT REFERENCES book_files(id) ON DELETE SET NULL,
  source_sha256 TEXT,
  chapter_ref TEXT,
  cfi TEXT,
  selected_text TEXT,
  prefix TEXT,
  suffix TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('comment', 'suggestion')),
  category TEXT NOT NULL CHECK(category IN ('general', 'grammar', 'spelling', 'story', 'logic', 'style')),
  body TEXT NOT NULL,
  proposed_text TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility = 'private'),
  submitter_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'accepted', 'declined', 'resolved', 'withdrawn')),
  mutation_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_book ON editorial_feedback(book_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submitter ON editorial_feedback(submitter_email);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON editorial_feedback(status);

CREATE TABLE IF NOT EXISTS feedback_replies (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES editorial_feedback(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK(author_role IN ('reader', 'creator')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_replies_feedback ON feedback_replies(feedback_id);

CREATE TABLE IF NOT EXISTS feedback_events (
  id TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES editorial_feedback(id) ON DELETE CASCADE,
  actor_email TEXT NOT NULL,
  event TEXT NOT NULL CHECK(event IN ('created', 'replied', 'accepted', 'declined', 'resolved', 'reopened', 'withdrawn', 'exported')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_feedback ON feedback_events(feedback_id);
