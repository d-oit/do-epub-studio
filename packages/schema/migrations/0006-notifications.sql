-- Migration: 0006-notifications
-- Description: Add notifications table for comment reply notifications
-- Created: 2026-07-18

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    book_id TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    parent_comment_id TEXT,
    type TEXT NOT NULL DEFAULT 'reply' CHECK(type IN ('reply', 'mention', 'system')),
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_email);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_email, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_book ON notifications(book_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);