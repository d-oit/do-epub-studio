# GOAP-1007: Resolve all open GitHub issues #1323–#1330 and PRs #1322/#1331

**Status:** IN PROGRESS
**Date:** 2026-10-14
**Trigger:** User requested implementation of every open GitHub issue, correct-order merge of every open PR, and green CI.
**Related:** ADR-313, TRIZ analysis `analysis/triz-core-2026-10-14.md`, issues [#1323](https://github.com/d-oit/do-epub-studio/issues/1323)–[#1330](https://github.com/d-oit/do-epub-studio/issues/1330), PRs [#1322](https://github.com/d-oit/do-epub-studio/pull/1322) and [#1331](https://github.com/d-oit/do-epub-studio/pull/1331).

## Goal

Close every listed issue with its complete acceptance criteria, merge both currently open PRs without bypassing branch protection, and leave all required checks green. Preserve the user's stashed `packages/schema/src/index.ts` change intact.

## Inventory and evidence

Exactly eight open issues and two open PRs were found. Implementation must follow issue bodies, not the originating analysis's unverified hotspot estimates.

| Issue | Acceptance scope                                                                                                                                                                                                                                                          | Primary code/verification areas                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| #1323 | Split loader/rendition/navigation/annotation hooks; `useReaderEpub` facade under 80 LOC; focused hook tests; theme/font changes preserve archive and CFI; measure renders; existing reader E2E                                                                            | `apps/web/src/features/reader/hooks/`, `ReaderPage.tsx`, toolbar; hook tests and Playwright reader flows       |
| #1324 | Session/grant middleware and access/comment services; route-focused HTTP mapping; runtime schemas; preserve auth/error contracts; authorization, expiry, revocation, validation, ownership tests                                                                          | Worker middleware, access/comments/email transport, services and route tests                                   |
| #1325 | Cross-tab single-flight; stable idempotency IDs; capped exponential backoff with jitter; terminal failures do not block later work; durable inspect/retry/export UI; revision conflicts retained/resolvable                                                               | Offline sync/IndexedDB, comments/progress API, ReaderPage sync UI; unit and browser tests                      |
| #1326 | Ordered independently tested CFI/position/quote-context re-anchor strategies; bounded work; sanitizer security/valid-content fuzz vectors; benchmark 100 annotations × 50 KB with documented hardware and realistic result                                                | `packages/reader-core/src/reanchor.ts`, sanitizer modules/tests, reader-core benchmark and tests               |
| #1327 | Stable content-hashed EPUB revisions; preserved old anchors; resumable/idempotent migration with confidence/outcome; ambiguous/deleted anchors stay reviewable; admin upload, tests                                                                                       | Admin upload/books, schema migrations, annotation services, admin/reader UI, migration tests                   |
| #1328 | Offline chapter index/search built and queried in a Worker; encrypted revision-bound IndexedDB persistence; accessible Cmd/Ctrl+K drawer with snippets/counts/CFIs; documented 300-page benchmark; filtered Markdown, JSON-LD, CSV, JSON exports with auth/escaping tests | Reader search/toolbar, offline database, export routes/schemas; Worker/browser tests and benchmark             |
| #1329 | Two-context divergence, transient failure with exactly-once effects, hard reload offline restoring book, exact CFI and pending annotations; deterministic observable waits                                                                                                | PR #1331 tests plus offline sync implementation; Chromium/Firefox/WebKit E2E                                   |
| #1330 | Repair the scheduled CI failure at its source without hiding network errors, weakening scans, or extending timeouts                                                                                                                                                       | Scheduled Playwright fixtures/backend setup and CI workflow; reproduce affected cases and rerun scheduled lane |

### Baseline observations

- The scheduled run [38527499601](https://github.com/d-oit/do-epub-studio/actions/runs/38527499601) at main `86a1e562` reported 772 passes, 13 failures, 5 flaky tests, and 21 skips. Logs include repeated AxeBuilder 60-second timeouts/browser closure, a demo login remaining at `/login?book=demo`, and `ECONNREFUSED 127.0.0.1:8787` from unmocked API calls.
- Playwright preview serves the web app but does not start the Worker; Vite's `/api` proxy targets port 8787. Existing E2E fixture comments document that unmocked bookmark/API requests have no backend and can interfere with reader tests. Fix fixture/backend ownership rather than suppressing failures.
- `apps/tests` has a lint script but no `test:unit`; the historical PR #1331 Fast Check selected that package and failed the recursive missing-script command. Current head `8210b239` made Fast Check pass by adding `test:unit: "echo 'No unit tests…'"`, a no-op that must be removed rather than treated as test evidence. Root `verify:fast` now uses Turbo task discovery; an explicit `tests` path output is being wired to smoke coverage without waking the benchmark job.
- PR #1331's current Codacy result is one high Biome `useQwikValidLexicalScope` finding in `offline-sync-conflicts.spec.ts:175`; its test-only diff still skips E2E Smoke. The hard-reload scenario only checks that a progress row exists, not that the exact CFI is restored or the matching chapter is rendered. The five-queue scenario duplicates the app encryption implementation; replace it with the shared helper and real UI-created mutations. Remove broad `suppressWorkboxErrors` use from the new cases.
- PR #1322 overlaps `reanchor.ts`; all quality checks were green in the observed run except the PR-title and commit-range 72-character checks. Its title and offending commit subject were 75 characters; the PR title has been shortened, and the original source diff hash is preserved for the commit-message repair.
- Existing code already has server-side mutation-ID deduplication for comment creation. Retain that contract; extend it to the required mutation paths rather than inventing a second idempotency scheme.

## Decisions and merge order

1. Repair PR #1322 title/commit metadata without changing its code diff; wait for all required checks, resolved review threads, and an up-to-date clean merge state; squash-merge first because #1326 edits the same re-anchor implementation.
2. Implement issues #1323–#1328 and #1330 on a feature branch, using the accepted decisions in ADR-313. Keep one issue's code/test ownership coherent where files overlap; no partial shims or weakened checks.
3. Run behavior-focused tests, scheduled failure reproduction, accessibility/security suites, benchmark, workflow validation, and the repository quality gate. Record hardware and measured results; preserve any target not reached with a measured justification rather than a fabricated pass.
4. Open and merge the implementation PR only after all required checks and Codacy pass, all review threads are resolved, and branch is current.
5. Rebase/update PR #1331 onto the resulting main, fix any incomplete assertions/formatting, confirm its E2E tests execute, wait for every required check, then squash-merge it. This preserves the original open PR as an independent, reviewable test change and avoids duplicating its diff in the implementation PR.
6. Close issue #1329 via PR #1331; close #1323–#1328 and #1330 from the implementation PR only after their full criteria are verified. Re-query all issues, PRs, checks, branch rules, and stash state at the end.

## Implementation phases

| Phase | Deliverable                                                                                                             | Evidence required                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0     | Keep a clean feature branch; preserve stashed user change; write TRIZ analysis and accept ADR-313                       | Branch/worktree evidence; plan and ADR index                                                               |
| 1     | Fix/merge PR #1322 first                                                                                                | All required checks green, no unresolved review threads, clean/up-to-date status                           |
| 2     | Repair scheduled E2E environment and smoke-path coverage; make changed-package fast checks tolerate absent unit scripts | Reproduce affected failure; focused Playwright run; workflow validation                                    |
| 3     | Extract worker middleware/services without auth regressions                                                             | Worker route/service tests for auth/forbidden/expiry/revocation/validation/owner branches                  |
| 4     | Harden offline outbox, explicit conflict handling, durable failure actions                                              | Deterministic unit/browser tests for multi-trigger, tabs, 4xx progress, 429/5xx, conflict and recovery     |
| 5     | Modularize re-anchoring, fuzz sanitizer and measure benchmark                                                           | Strategy tests; security/valid-content vectors; reproducible 100 × 50 KB benchmark and complexity baseline |
| 6     | Add revision upload, migration state/resume, orphan review                                                              | Migration tests for moved/ambiguous/deleted/retry; admin upload and reader review flow                     |
| 7     | Decompose reader hooks and implement offline search/exports                                                             | Hook tests; measured render behavior; offline search CFI smoke; export permission/escaping/filter tests    |
| 8     | Update and merge #1331 after implementation                                                                             | All three E2E scenarios green repeatedly, exact CFI assertion, no sleeps, all CI checks green              |
| 9     | Reconcile issues and release evidence                                                                                   | Required CI, Codacy, workflow validation and quality gate green; issue/PR state and stash preserved        |

## Quality constraints

- Do not lower thresholds, disable/suppress checks, relax security policy, or claim an unobserved result.
- Preserve authorization, tenant isolation, and encrypted offline persistence.
- Store annotation/revision history so low-confidence migrations remain recoverable.
- Add/reuse permanent tests only for user-visible behavior, invariants, and security boundaries.
- Record non-obvious repository learning in `agents-docs/LEARNINGS.md` after implementation; do not edit the known-issues register.

## Official references used

See `analysis/triz-core-2026-10-14.md` for current Cloudflare Workers/D1, GitHub branch protection/Actions security, Playwright, W3C annotation/accessibility, and React sources consulted on 2026-10-14.
