-- Migration: 0003-epub-validation
-- Description: Add validation results to book files
-- Created: 2026-05-24

ALTER TABLE book_files ADD COLUMN validation_results_json TEXT;
