# ADR-003: Storage Model

**Status:** Accepted  
**Date:** 2026-04-07

## Context

We need to decide where to store:

1. EPUB file bytes (large binary files)
2. App metadata (books, users, grants)
3. Reading state (progress, annotations)
4. Local browser state (offline cache)

**Contradiction:** Performance vs Flexibility - we need fast access to large files AND flexible querying of metadata.

## Decision

### Storage Assignment

| Data Type | Storage | Reason |
|-----------|---------|--------|
| EPUB files | R2 | Large binaries, streaming, cost-effective |
| Book metadata | Turso | Relational queries, schema validation |
| User/grants | Turso | Permissions, audit trail |
| Progress/annotations | Turso | Syncable, queryable |
| Offline cache | IndexedDB + Cache Storage | Browser-local, fast |

### R2 for EPUB Files

- EPUB bytes stored as R2 objects
- Key format: `books/{bookId}/epub/{fileId}.epub`
- Covers stored separately: `books/{bookId}/cover.{ext}`
- All access via signed URLs from Worker

### Turso for App State

- SQLite schema with explicit tables
- Turso edge replicas for low latency
- Migrations in `packages/schema/migrations/`
- Types generated from schema

### Browser Local Storage

- IndexedDB: progress, bookmarks, highlights, comments, sync queue
- Cache Storage: app shell, static assets, cached EPUB assets

## Consequences

**Positive:**

- R2 is cheaper and faster for large files than Turso blobs
- Clear separation of concerns
- Turso schema provides type safety
- Offline-first works with local-first writes

**Negative:**

- Two storage systems to manage
- Sync logic must handle both R2 and Turso

## References

- TRIZ Analysis: Contradiction #3 - Performance vs Flexibility
- Resolution: Adapter pattern, Segmentation principle
- Storage adapter layer isolates R2/Turso differences
