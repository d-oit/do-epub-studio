# GOAP-311: Restore the work reverted by the 2026-10-04 stale-base squash (`7e0cbd6c`)

**Status:** DONE — code, tests, scripts and their cited plan/analysis records restored
**Date:** 2026-10-06
**Type:** Repo-integrity repair (restores work reverted by an unrelated merge)
**ADR:** `plans/311-adr-stale-base-squash-restoration.md` (ADR-311, Accepted)
**Source finding:** GOAP-1000 audit follow-up; surfaced while repairing the `46d7a98f` clobber of PR #1287
**Related:** `plans/310-goap-telemetry-retention-restore.md` (the same class, smaller), `plans/1000-goap-implementation-security-e2e-feature-audit.md`

## Why

`7e0cbd6c` ("fix(deploy): prevent SPA fallback HTML on /api/* routes", PR #1262) was
squash-merged from a branch cut before PRs #1264, #1273, #1274, #1275 and the
creator-workspace slice merged. It therefore deleted **53 paths** those PRs had
delivered — 31 code/test/script files and 22 plan/analysis documents — while its
own message mentions only the SPA routing fix. Its consumers were reverted with
them, so CI stayed green and the loss went unnoticed until the audit row A8 had
to be re-opened as "REOPENED upstream".

The same failure mode clobbered PR #1287 minutes after it merged
(`46d7a98f`, PR #1293) — repaired separately in PR #1299. ADR-311 records the
policy; this plan is the execution.

## What was restored (31 code/test/script paths + 22 cited records)

| Area                | Restored paths                                                                                                                                                                                                                                                                               | Contract brought back                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Offline annotations | `lib/offline/annotation-mutations.ts`, `lib/offline/sync-item.ts`, `__tests__/reader-annotations.offline.test.tsx`, `__tests__/offline-db.book-files.test.ts`, worker `__tests__/annotations-idempotency.integration.test.ts`, `packages/schema/migrations/0019-annotation-mutation-ids.sql` | Atomic encrypted persist + idempotent replay (`mutation_id`), failed-state reporting                       |
| Offline reading     | `features/reader/hooks/useBookFileUrl.ts` (+ wiring in `ReaderPage`)                                                                                                                                                                                                                         | Encrypted at-rest signed-URL cache used only while offline; a failed online request surfaces as an error   |
| Locale recovery     | `hooks/useLocaleReload.ts`, `hooks/__tests__/useLocaleReload.test.ts`, `__tests__/i18n-locale-load.test.ts`                                                                                                                                                                                  | `localeStatus`/`reloadRequested` envelope and reload-on-reselect                                           |
| Reader spine        | `lib/epub-sections.ts` (+ test), `features/reader/lib/epub-presentation.ts`, `features/reader/hooks/useCommentHandlers.ts`                                                                                                                                                                   | `book.sections`/`book.spine` normalisation and presentation helpers                                        |
| Creator workspace   | `features/creator/hooks/useEditorialReview.ts`, `features/creator/lib/book-chapters.ts` (+ test), `features/creator/lib/editorial-dispatch.ts` (+ test)                                                                                                                                      | Grounded review load/state machine and per-category engine dispatch                                        |
| Logging privacy     | `packages/shared/src/redact.ts` (+ test)                                                                                                                                                                                                                                                     | Correlation-preserving scrubber at the shared boundary                                                     |
| Tooling             | `scripts/check-plan-references.mjs` (+ test), `scripts/web-ui/lib/playwright.mjs`, `apps/web/src/__tests__/helpers.ts`, `apps/worker/src/__tests__/helpers.ts`                                                                                                                               | Plan-reference validator, web-ui pack helper, `defined()` test helper                                      |
| Superseded test     | `features/reader/components/info/InfoPanel.insights.test.tsx`                                                                                                                                                                                                                                | Real-summary-pipeline assertion (adapted to the N1 local/synced split)                                     |
| Cited records       | plans 290–308 (both `300-*`), `analysis/comprehensive-gap-audit.md`, `analysis/feature-docs-harness-audit.md`                                                                                                                                                                                | The evidence the restored code/tests/docs still cite (GOAP-290–308); the plan-reference gate requires them |

Also restored as a consequence of the same rollback: strictness parity
(`noUncheckedIndexedAccess`) in `apps/web`/`apps/worker` tsconfigs, the
`bookFiles` IndexedDB store (`DB_VERSION` 5) and the `ANNOTATION_PLAINTEXT` /
`SYNC_QUEUE_PLAINTEXT` exports that the restored modules import. Kept at HEAD
against the mechanical revert (the one clean deletion ADR-311 §4 overrules):
`apps/web/public/_routes.json` — born in the offending commit itself as the
routing fix (`"include": ["/api/*"]`), with no prior history. The offending
commit's seven zombie re-additions (the four files `1d60254f` had deleted —
`scripts/bootstrap.mjs`, `scripts/db-migrate-local.mjs`, `vitest.workspace.ts`,
`apps/tests/reading-insights.spec.ts` — plus the worker `redact.ts` pair and
`docs/setup-turso.md`) stay deleted.

## Method (ADR-311 §4)

1. `git revert -n 7e0cbd6c` recovers the entire rollback in one step.
2. Conflicts (13) resolved **keeping HEAD** for every hunk that belongs to the
   offending commit's intended fix (release health check, `cloudflare-login`
   spec, demo login/admin pages, `LEARNINGS.md`, the reader/test files later
   PRs touched, bundle/LOC baselines, ADR index) and for all subsequent work.
3. `apps/web/src/lib/offline/db.ts` merged by hand: the restored pre-clobber
   surface **plus** the S1/S2 guards (`feedbackDrafts` in the purge list) and the
   `bookFiles` store.
4. Re-integration discovered by the gate, each failure naming the next file:
   - strictness parity returned → `reset.test.ts` uses the restored `defined()`
     helper again;
   - the restored `useBookFileUrl` had no consumer → `ReaderPage` now calls it
     (replacing the inline fetch), which is the A5 offline-capability feature;
   - `useAuthStore.subscribe` is called defensively (`?.`) because several test
     suites replace the auth store with a partial double;
   - restored tests that contradicted newer, intentional behaviour were adapted
     to the new behaviour (`LoginPage` demo-error expectation, `InfoPanel`
     local-empty state) — never the reverse.
5. The revert's one clean deletion that violated the step-2 rule is corrected
   here: `apps/web/public/_routes.json` — the routing fix itself, born in the
   offending commit — is kept at HEAD. The offender's seven other clean deletions
   were zombie re-additions of files `1d60254f` had deleted, so they stand.

## Why the cited plan/analysis records come back with the code

The 22 deleted plan/analysis documents (plans 290–308, `analysis/comprehensive-gap-audit.md`,
`analysis/feature-docs-harness-audit.md`) are restored alongside the code: the
restored code, tests, runbooks and audit scripts cite GOAP-290–308 by number,
and dropping the records broke the restored `check-plan-references.mjs` gate
on 73 living citations. GOAP-1000's reconciliation still records `7e0cbd6c` as
the commit that removed them upstream, and GOAP-310 supersedes plan 305.

## Verification

- `pnpm turbo run typecheck --force` 7/7; `pnpm lint` 8/8 + 15 workflows.
- `pnpm --filter @do-epub-studio/web test:unit`, `.../worker test:unit`,
  `.../shared test:unit` — see the PR's verification block for the exact counts.
- `bash scripts/dead-code-check.sh` clean (no unused exports, no cycles) once
  `useBookFileUrl` was wired.
- `./scripts/quality_gate.sh` exit 0, including the restored
  `scripts/check-plan-references.mjs` gate under `gate-manifest.json`.
- `node scripts/check-adr-index.mjs` exit 0.

## Prevention

The three checks ADR-311 makes standard: rebase status before merge
(`mergeStateStatus` ≠ `BEHIND`), delivered-path listing after merge
(`git ls-tree -r origin/main -- <path>`), and an audit row that names the
deleting commit when something disappears.
