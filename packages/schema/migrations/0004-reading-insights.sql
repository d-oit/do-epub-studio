-- Migration: 0004-reading-insights
-- Description: Coarse per-book reading insight aggregates
-- Created: 2026-06-19

-- Reading insights: coarse daily aggregates per book per reader
CREATE TABLE IF NOT EXISTS reading_insights (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    bucket_date TEXT NOT NULL,
    active_minutes INTEGER NOT NULL DEFAULT 0 CHECK(active_minutes >= 0 AND active_minutes <= 1440),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    UNIQUE(book_id, user_email, bucket_date)
);

CREATE INDEX IF NOT EXISTS idx_reading_insights_book_email ON reading_insights(book_id, user_email);
CREATE INDEX IF NOT EXISTS idx_reading_insights_bucket ON reading_insights(bucket_date);
