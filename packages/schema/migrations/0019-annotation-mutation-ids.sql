ALTER TABLE highlights ADD COLUMN mutation_id TEXT;
CREATE UNIQUE INDEX idx_highlights_mutation_id
  ON highlights(mutation_id) WHERE mutation_id IS NOT NULL;
ALTER TABLE comments ADD COLUMN mutation_id TEXT;
CREATE UNIQUE INDEX idx_comments_mutation_id
  ON comments(mutation_id) WHERE mutation_id IS NOT NULL;
