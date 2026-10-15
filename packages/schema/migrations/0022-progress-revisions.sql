ALTER TABLE reading_progress ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reading_progress ADD COLUMN mutation_id TEXT;
CREATE TABLE reading_progress_mutations (
  mutation_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  progress_id TEXT NOT NULL,
  locator_json TEXT NOT NULL,
  progress_percent REAL NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY (book_id, user_email, mutation_id)
);
