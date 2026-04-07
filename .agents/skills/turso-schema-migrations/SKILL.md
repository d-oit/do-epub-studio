# Skill: Turso Schema Migrations

## Purpose
Manage schema design, migrations, and Turso operations.

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
