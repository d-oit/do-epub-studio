# GOAP-238: Baseline Verification — Plan Closure, Docs Drift & Pre-Existing Code Fixes

**Date:** 2026-08-14
**Status:** ✅ COMPLETED (merged as PR #978, commit e8bfa29)
**Baseline:** `main` @ `3bd190d` (post GOAP-237, PR #977)
**Related:** Plans 226–237; ADR-219/ADR-234 closure records; ADR-INDEX

## Goal

Verify the `plans/` folder against `main` (verify-driven, per GOAP-226 method),
close stale plan statuses and the ADR index, fix verified documentation drift and
pre-existing code issues, and ship in a single CI-green PR. Confirm that the
remaining "deferred" audit items are genuinely gated and not implementable here.

## Analysis (two-scout parallel verification against source)

A read-only scout swarm (plans + code) cross-checked every live plan status and
each deferred item against `main`.

**Plan closure status (verified against git history):**

| Plan | Declared status | Verified reality | Edit |
| --- | --- | --- | --- |
| 237 risk-event handling | In Progress | MERGED as PR #977, commit `3bd190d`; all 9 ACs `[x]`, `audit/risk.ts` present | → `✅ COMPLETED (merged as PR #977, commit 3bd190d)` |
| 236 items 5+6 review | Complete | MERGED as PR #975, commit `a3827d5` | → `✅ Complete (merged as PR #975, commit a3827d5)` |
| 234 closure record | Item 7 "deferred" | Item 7 SHIPPED via #977 | Rewrite closure record |
| ADR-INDEX | 234 row omits item 7; 226–229/236/237 absent from GOAP table | Missing | Update row 234; add 6 GOAP rows |

**Deferred items (external input, correctly gated):** R1/R12/N3 email gate,
S1–S9, O2, P5/P7 (private security triage per ADR-212/214) — NOT implementable in
an open PR. ADR-217 OTel decision — accepted deferral; no reopen trigger.
reader-core public-API helper removal — verified consumers exist in `apps/web`;
removing the published surface is not safe to ship.

**Pre-existing code issues (scout-verified):**
- `apps/web/src/lib/offline/sync.ts` — over-broad `message.includes('permission')`
  fallback treats any generic "permission denied" (non-401/403) as revocation,
  spuriously clearing the local permission cache + dropping the sync item. The
  API client always sets `.status` on HTTP errors, so the fallback should match
  only an explicit `revoked` mention.
- `packages/reader-core/src/epub-loader.ts` — sole production non-null assertion
  (`eventListeners.get(event)!`) removable with a guarded local.

**Docs drift (scout-verified):**
- `docs/offline.md` retry-delay comment (actual 2s/4s/8s/16s/30s), missing
  `external-assets` cache row, permission-detection wording.
- `docs/architecture.md` `audit_log` table name, EpubLoader interface members,
  "append-only comments" risk note.
- `docs/security.md` `audit_log` table name.
- `docs/reading-insights.md` stale InfoPanel test path.

## Implementation

| Slice | Scope | Files |
| --- | --- | --- |
| A (swarm) | Docs drift | `docs/offline.md`, `docs/architecture.md`, `docs/security.md`, `docs/reading-insights.md` |
| B (swarm) | Plan statuses + ADR index | `plans/237-*`, `plans/236-*`, `plans/234-*`, `plans/ADR-INDEX.md` |
| C (swarm) | sync.ts error classification + tests | `apps/web/src/lib/offline/sync.ts`, `apps/web/src/lib/offline/sync.test.ts` |
| D (coordinator) | epub-loader non-null cleanup; GOAP-238 record + index row | `packages/reader-core/src/epub-loader.ts`, `plans/238-*`, `plans/ADR-INDEX.md` |

## Acceptance Criteria

- [ ] All stale plan statuses corrected (237, 236, 234 closure record); ADR-INDEX
  reflects 226–229/236/237/238 and item-7 closure.
- [ ] sync.ts no longer treats a generic `permission` substring as revocation;
  unit tests cover both a non-status revoked message (clears permissions) and a
  generic permission message (does NOT clear permissions).
- [ ] epub-loader non-null assertion removed; behavior unchanged.
- [ ] All documented drift corrected; markdownlint clean on edited files.
- [ ] `pnpm lint`, `pnpm typecheck`, web/reader-core unit suites, `pnpm knip`,
  `node scripts/check-adr-index.mjs` all green.
- [ ] Full CI green on the PR (fast-check, quality-gate, build, bundle, e2e-smoke,
  bench, bundle-size, docs-validation); all PR review comments addressed.

## Out of Scope (verified, still tracked)

- **Vitest 4 deprecation warnings** (`test.poolOptions` → top-level options;
  `__dirname` under `configLoader: 'native'`) in `apps/web/vitest.config.ts` (and
  sibling packages). Leaving unchanged: migrating pool config is governed by
  ADR-216 test-isolation policy and risks destabilizing the suite; the warnings
  are benign and all tests pass. Track as a dedicated Vitest-4 migration.
- **Source >500 LOC policy outliers** — `apps/worker/src/routes/admin/auth.ts`
  (~1220) and `packages/schema/src/schemas.ts` (~544). No enforced gate; splitting
  is a larger, higher-risk refactor on security-sensitive auth/schema surface —
  tracked separately, not in this cleanup PR.
- Private security triage items (R1/R12/N3 email gate, S1–S9, O2, P5/P7) and the
  ADR-217 OTel decision remain deferred as before.
