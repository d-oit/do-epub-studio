---
version: "1.0.0"
name: turso-schema-migrations
description: >
  Design Turso schema and write migrations. Activate for table design,
  migration scripts, or SQLite-compatible schema changes.
category: workflow
allowed-tools: Read Write Edit Grep Glob
license: MIT
---

# Turso Schema Migrations

Manage schema design, migrations, and Turso operations for d.o.EPUB Studio.

## Key Responsibilities

- Design and version schema changes.
- Write migration scripts.
- Ensure SQLite compatibility.
- Provide rollback-safe migration steps.

## Interface Example

```sql
-- Example migration file
-- migrations/20260407_create_tables.sql
```

## Constraints

- Migrations must be idempotent and reversible.
- Indexes must be added in a way that doesn't break existing queries.
- Use timestamp-prefixed filenames (YYYYMMDD_name.sql).

## Migration Pattern

```sql
-- Good: Idempotent migration
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Good: Safe index addition
CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id);
```

## Naming Convention

- Migration files: `YYYYMMDD_description.sql`
- Tables: snake_case, plural (e.g., `books`, `permissions`)
- Columns: snake_case (e.g., `book_id`, `created_at`)

## Examples

### Migration File

Migrations live in `packages/schema/migrations/` as sequentially numbered SQL files. Add a column with a safe `ALTER TABLE` (from `packages/schema/migrations/0003-epub-validation.sql`):

```sql
-- Migration: 0005-add-pages-to-insights
-- Description: Track active page count alongside active minutes
-- Created: 2026-06-01

ALTER TABLE reading_insights ADD COLUMN active_pages INTEGER NOT NULL DEFAULT 0;
```

### Apply Migrations

D1 binding is `DB` (see `apps/worker/wrangler.jsonc`). Apply all pending migrations with Wrangler:

```bash
# Apply to production D1 database
wrangler d1 migrations apply do-epub-studio

# Verify applied migrations
wrangler d1 migrations list do-epub-studio

# Run an ad-hoc check
wrangler d1 execute do-epub-studio --command="SELECT COUNT(*) FROM books"
```

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "A migration only runs once, so plain `CREATE TABLE` is fine" | Migrations must be idempotent and reversible; every table and index is created with `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` so a re-apply is harmless. |
| "The table is tiny, so `ALTER TABLE ... ADD COLUMN ... NOT NULL` will just work" | Existing rows need a default: the repo pattern is `ALTER TABLE reading_insights ADD COLUMN active_pages INTEGER NOT NULL DEFAULT 0` (`0005-add-pages-to-insights`). |
| "I'll rebuild the index to make it faster" | Index changes must not break existing queries; add them with `CREATE INDEX IF NOT EXISTS` (for example `idx_books_owner`). |
| "The filename is cosmetic — `add_pages.sql` is clear enough" | Filenames follow the directory convention in `packages/schema/migrations/` (`0003-epub-validation.sql`, `0005-add-pages-to-insights`); a name that sorts wrong desynchronizes `wrangler d1 migrations apply`. |
| "I'll just run the DDL against D1 directly to save time" | Pending migrations are tracked through `wrangler d1 migrations apply do-epub-studio` / `list`; out-of-band DDL is untracked and leaves environments divergent. |

## Red Flags

- [ ] Migration uses unguarded DDL: `CREATE TABLE`, `CREATE INDEX`, or `DROP` without `IF EXISTS`.
- [ ] `ALTER TABLE ... ADD COLUMN ... NOT NULL` omits a `DEFAULT` for existing rows.
- [ ] New tables or columns are singular or camelCase (`bookId`, `permission`) instead of snake_case plural (`book_id`, `permissions`).
- [ ] The new migration filename does not follow its neighbours' convention in `packages/schema/migrations/`.
- [ ] DDL is applied directly to D1 instead of via `wrangler d1 migrations apply do-epub-studio`, or the binding is not read from `DB` in `apps/worker/wrangler.jsonc`.
- [ ] The change ships without a reversal step, despite migrations being required to be rollback-safe.
