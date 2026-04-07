---
name: turso-schema-migrations
description: Manage Turso database schema design, migrations, and SQLite operations. Use when designing database tables, writing migration scripts, or handling schema changes.
license: MIT
---

# Turso Schema Migrations

Manage schema design, migrations, and Turso operations for EPUB Studio.

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
