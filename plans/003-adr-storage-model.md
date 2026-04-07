# 003: ADR - Storage Model

## Decision
- **EPUB files**: Cloudflare R2
- **App state, permissions, progress, comments, audit logs**: Turso
- **Local browser storage**: IndexedDB + Cache Storage

## Rationale
- Separation of concerns: files vs. metadata/state.
- R2 is cost-effective for file storage.
- Turso provides SQLite-style app state with sync capabilities.
- IndexedDB enables offline reading and queued sync.

## Consequences
- Simpler, safer, and more scalable than treating Turso as the primary EPUB store.
