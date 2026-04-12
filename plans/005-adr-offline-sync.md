# ADR-005: Offline Sync

**Status:** Accepted  
**Date:** 2026-04-07

## Context

Readers need to:

- Read books offline after initial authentication
- Create annotations offline
- Sync when back online
- Handle conflicts gracefully

**Contradictions:**

- #2: Offline capability vs Access Control
- #5: Local-first editing vs Consistency

## Decision

### Dual-Cache Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Cache Storage  │     │    IndexedDB    │
│  (App shell,     │     │  (Progress,     │
│   EPUB assets)   │     │   annotations,   │
│                  │     │   sync queue)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌──────────────────┘
         │    │
         ▼    ▼
┌─────────────────────────────────┐
│         Sync Manager            │
│  (Queue, retry, conflict)       │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│     Cloudflare Worker API       │
└─────────────────────────────────┘
```

### Cache Strategy

| Content | Storage | TTL | Strategy |
|---------|---------|-----|----------|
| App shell | Cache Storage | Permanent | Cache-first |
| Static assets | Cache Storage | 7 days | Stale-while-revalidate |
| EPUB assets | Cache Storage | 30 days | Network-first |
| Cover images | Cache Storage | 30 days | Cache-first |
| Book metadata | IndexedDB | 24 hours | Network-first |
| Progress | IndexedDB | Immediate | Local-first |
| Annotations | IndexedDB | Immediate | Local-first |

### Sync Rules

**Client-side:**

1. Write locally first (optimistic)
2. Enqueue sync job
3. Attempt sync when online
4. Retry with exponential backoff

**Server-side:**

- Idempotent mutation IDs (UUID v7)
- Last-write-wins for progress/preferences
- Append-only for comments
- Explicit merge for highlights

### Permission Caching

- Cache granted permissions for offline access
- TTL: 24 hours (configurable)
- **Zombie detection:** On sync, validate session is still valid
- If revoked while offline: show warning, prevent new reads

### Offline-First Entities

| Entity | Write | Conflict Strategy |
|--------|-------|-------------------|
| Progress | Local-first | Last-write-wins |
| Bookmarks | Local-first | Last-write-wins |
| Highlights | Local-first | CRDT merge |
| Comments | Local-first | Append + manual |
| Preferences | Local-first | Last-write-wins |

## Consequences

**Positive:**

- Works fully offline after initial auth
- Fast reads via cache
- Resilient to network issues

**Negative:**

- Sync complexity
- Potential for conflicts
- Permission cache staleness

## References

- TRIZ Analysis: Contradictions #2, #5
- Resolution: Segmentation, Feedback, Composite Materials principles
