-- Migration: 0015-assistance-consent
-- Description: Wave 4 (GOAP-999, AI-02; ADR-999 D5): per-book, per-creator
-- permission to use *cloud* processing. Defaults to 0 (off) for every existing
-- and future assignment. This flag is consent-only — it can never enable
-- dispatch on its own, because no cloud provider is qualified (see
-- packages/reader-core/src/ai/qualification.ts). The global AI toggle is
-- deliberately not consulted here.
-- Created: 2026-09-12

ALTER TABLE book_creators ADD COLUMN cloud_assistance_allowed INTEGER NOT NULL DEFAULT 0;
