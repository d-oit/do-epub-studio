# AGENTS.md — offline-data-integrity

Repo-specific invariants:

- `DB_VERSION` in `apps/web/src/lib/offline/db.ts` is currently 5; every schema change bumps it and adds an idempotent case in `upgrade(db, oldVersion)`. Never mutate stores in place.
- Sensitive local writes must `captureSessionToken()` before the await and `assertSessionToken()` immediately before the IDB write — a write that crosses a session boundary must abort.
- Sync is intent-preserving and idempotent; never silently drop conflicts; permission revocation cleanup runs via `auth-loss-cleanup.ts`.
- Quota errors are handled gracefully (eviction + retry); half-written downloads are never left behind.
- Recovery: every store can drop bad (undecryptable/corrupt) rows and resync from the server canonical entry.
- Offline changes must keep the `src/lib/offline` vitest suite green (run under `flock -w 900 /tmp/vitest.global.lock`).
