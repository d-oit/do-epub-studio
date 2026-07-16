# Turso Database Setup Guide

This project uses [Turso](https://turso.tech) (libSQL) as its database, running
on Cloudflare Workers with edge-replicated reads.

## Prerequisites

- [Turso CLI](https://docs.turso.tech/cli/installation)
- Turso account (free tier works for development)

## Create a Database

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Login
turso auth login

# Create a database
turso db create do-epub-studio

# Get the connection URL
turso db show do-epub-studio --url

# Create an auth token
turso db tokens create do-epub-studio
```

## Local Development

### Option 1: Turso Cloud (recommended)

Use your Turso cloud database directly:

```env
# .dev.vars (project root)
TURSO_DATABASE_URL=libsql://do-epub-studio-your-org.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### Option 2: Local SQLite

For fully offline development, use the Turso CLI's local replica:

```bash
turso db replicate do-epub-studio file:local.db
```

Then point your `.dev.vars` at the local file.

## Schema & Migrations

Schema definitions live in `packages/schema/src/`. Migrations are managed via
the Turso schema migrations skill.

### Running Migrations

```bash
# Apply migrations to the database
turso db shell do-epub-studio < migrations/001_initial.sql
```

### Schema Structure

Key tables:

- `users` — Admin and reader accounts
- `books` — EPUB metadata and storage references
- `grants` — Access grants linking users to books
- `sessions` — Active authentication sessions
- `reading_progress` — Per-user per-book reading position
- `annotations` — Highlights, comments, and bookmarks
- `audit_log` — Administrative action log

### Schema Validation

All database inputs and outputs are validated with Zod schemas defined in
`packages/schema/src/schemas.ts`. Run schema tests:

```bash
pnpm --filter @do-epub-studio/schema test
```

## Database Client

The Worker uses `@libsql/client` to connect:

```typescript
import { createClient } from '@libsql/client';

const db = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});
```

## Production

- **Edge replication** — Turso replicates data to Cloudflare edge locations
  for low-latency reads
- **Backups** — Automatic daily backups on paid plans
- **Monitoring** — Query performance visible in Turso dashboard

## References

- [Turso Documentation](https://docs.turso.tech)
- [libSQL](https://github.com/tursodatabase/libsql)
- Coding guide §4 — Database architecture
- `packages/schema/` — Schema definitions and Zod validation
