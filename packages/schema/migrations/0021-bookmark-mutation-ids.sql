ALTER TABLE bookmarks ADD COLUMN mutation_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_mutation_id
  ON bookmarks(mutation_id) WHERE mutation_id IS NOT NULL;
