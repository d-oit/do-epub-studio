-- Migration: 0005-add-pages-to-insights
-- Description: Add active_pages to reading_insights
-- Created: 2026-06-20

ALTER TABLE reading_insights ADD COLUMN active_pages INTEGER NOT NULL DEFAULT 0 CHECK(active_pages >= 0);
