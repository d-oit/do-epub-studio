---
name: offline-data-integrity
description: >
  Use for IndexedDB schema migrations, transactional downloads, sync
  idempotency, quota behavior, and recoverability. Not for service-worker
  caching mechanics (see pwa-offline-sync).
category: quality
allowed-tools: Read Write Edit Glob Grep Bash
version: "1.0.0"
license: MIT
---

# Skill: `epub-offline-data-integrity`

Purpose: keep local offline state correct — IDB migrations, transactional writes, idempotent sync, quota awareness, and session-safe storage — so offline features never corrupt or lose user data.

## When to Use

**Activate when:**
- Changing `apps/web/src/lib/offline/db.ts` (IDB schema/version/upgrade) or any store's record shape.
- Touching sync logic (`sync.ts`, `annotation-sync.ts`, `feedback-sync.ts`, `conflict-resolution.ts`, `sync-policy.ts`).
- Working on quota behavior (`StorageQuota.tsx`, `data-cache.ts`, `prefetch-manager.ts`) or download flows.
- Debugging offline corruption, duplicate sync, or unrecoverable local state.

**Activate when (extension):** service-worker caching/precache/offline-first network layer → `pwa-offline-sync`. This skill owns data integrity under that network layer.

## Inputs & Authority Hierarchy

1. **ADR-005 / architecture**: `docs/offline.md` — dual-cache architecture, IDB stores, sync protocol, retry, conflict resolution, permission revocation, SW lifecycle.
2. **DB module**: `apps/web/src/lib/offline/db.ts` — `DB_NAME = 'do-epub-studio'`, `DB_VERSION` (currently 5), upgrade(db, oldVersion) migration pattern; encrypted entries via `encryptJSON`/`decryptJSON`; `captureSessionToken`/`assertSessionToken` (session-safe writes, S1).
3. **Sync modules**: `apps/web/src/lib/offline/` — `sync.ts`, `annotation-sync.ts`, `feedback-sync.ts`, `conflict-resolution.ts`, `sync-policy.ts`, `sync-item.ts`, `sync-order.ts`, `sync-canonical-entry.ts` — idempotency and merge semantics.
4. **Types**: `apps/web/src/lib/offline/types.ts` — record shapes are the contract; changing shapes requires a migration.

## Safe CLI-First Workflow

1. Any schema change bumps `DB_VERSION` and adds a case in `upgrade(db, oldVersion)`; never mutate existing stores in place without a versioned migration. Keep migration code idempotent across skips.
2. Sensitive local writes capture the session token before the await and re-assert immediately before the IDB write (`assertSessionToken`); a write must never commit after its session ended.
3. Sync stays idempotent: sync queue entries keyed by id; retry preserves intent; conflict resolution follows `conflict-resolution.ts` policy — never drop a remote mutation silently.
4. Quota: account for storage use; handle `QuotaExceededError` gracefully with eviction/cleanup paths; verify `StorageQuota` calculations against actual usage.
5. Recoverability: every store must tolerate decryption/parse failures (drop bad rows) and be resyncable from the server (canonical entry path).
6. Verify with the offline test set below.

## REQUIRED Verification Commands
```bash
cd /home/doit/git/do-epub-studio   # or the active worktree
# Offline suite (db/sync/conflict/quota-adjacent)
flock -w 900 /tmp/vitest.global.lock pnpm --filter @do-epub-studio/web exec vitest run src/lib/offline
# Skill/catalog/sync gates
bash scripts/validate-skill-format.sh && bash scripts/validate-skills.sh && node scripts/check-agent-sync.mjs
```

## Expected Outputs

- Versioned IDB migrations that are idempotent and covered by tests.
- No session-crossing writes; sensitive entries encrypted.
- Sync idempotent — replaying a queue yields exactly-once effects; conflicts resolved per policy.
- Graceful quota handling and a recoverable local store (drop-and-resync path).

## Example Task

"Add a `downloadedMedia` store with a DB v6 migration, quota-aware eviction, and tests that migrate v5 data losslessly."

## Reference Files

- `references/guide.md` — store inventory, migration patterns, sync invariants.
- `docs/offline.md`
- `apps/web/src/lib/offline/db.ts`, `sync.ts`, `conflict-resolution.ts`
- `apps/web/src/components/StorageQuota.tsx`

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "I can add a field to an existing object store; old rows just lack it." | Record shapes are a contract; changing them without a versioned migration causes undefined reads on stale rows. Bump `DB_VERSION` and migrate. |
| "If the sync queue replays twice, one extra call is harmless." | Sync is exactly-once/intent-preserving; duplicate application is a correctness bug. Keep queue idempotency and conflict policy intact. |
| "The write started under a valid session, so it's fine to commit later." | The token must be re-asserted immediately before the IDB write; a session that ended mid-operation must abort the write (S1). |
| "Quota errors can just fail the download." | Quota must be handled gracefully: surface storage use, clear/evict, and retry — never leave a half-written download. |

## Red Flags

- [ ] `DB_VERSION` bumped without adding to `upgrade(db, oldVersion)`, or migrations not idempotent.
- [ ] Sensitive write without `captureSessionToken`/`assertSessionToken`.
- [ ] Sync replay loses or duplicates a mutation; conflict policy silent-drop.
- [ ] QuotaExceededError unhandled or no eviction path.
- [ ] Local store with no drop-and-resync recovery path.
- [ ] Offline changes landed without the `src/lib/offline` test set green.
