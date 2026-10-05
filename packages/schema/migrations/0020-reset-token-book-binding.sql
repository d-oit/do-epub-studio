ALTER TABLE password_reset_tokens ADD COLUMN book_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reset_tokens_book ON password_reset_tokens(book_id);
