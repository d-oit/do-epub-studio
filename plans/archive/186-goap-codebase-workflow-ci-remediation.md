# Plan 186: GOAP — Codebase, Workflow, and CI Remediation

**Status:** ✅ COMPLETED (via Plans 188-191, 196)
**Date:** 2026-07-14
**Decision:** [ADR-187](187-adr-fail-closed-engineering-gates.md)
**Strategy:** Hybrid; fix safety blockers sequentially, then execute independent workstreams in parallel

## Goal

Close the evidence-backed implementation, coding-workflow, and GitHub CI gaps found in the 2026-07-14 repository audit without reopening completed work or treating generic audit checklists as remediation.

## Scope and Evidence Baseline

The audit inspected application and Worker source, tests and coverage artifacts, root scripts, commit hooks, all GitHub workflows, custom actions, and existing plans. `git fetch origin main && git merge origin/main` reported that the checkout was current before this plan was written. `./scripts/validate-workflows.sh` passed, which establishes syntax, actionlint, current allowlist membership, and zizmor checks but does not prove the workflows fail closed semantically.

This plan is the issue-specific execution companion to Plans 129, 178/990, 180/992, 182/994, and 184/996. Those proposed plans define broad audit scopes; this plan records the concrete findings and acceptance tests. Duplicate plan pairs should be reconciled separately without losing history.

## Findings and Desired State

| ID | Priority | Finding and evidence | Desired state |
| --- | --- | --- | --- |
| I1 | P0 | Zombie detection asks IndexedDB for permission key `''` in `apps/web/src/lib/offline/permissions.ts:95-113`, while `apps/web/src/lib/offline/db.ts:251-256` performs an exact primary-key lookup. Revoked offline content therefore may not be cleared. | Process the server's revoked book IDs directly or enumerate real cached permissions; prove revocation clears only affected cached books. |
| W1 | P0 | `scripts/atomic-commit/run.sh:107-124` rolls back with `HEAD~1` and force-pushes without a lease, even though `ORIGINAL_SHA` is captured. A concurrent remote update can be deleted. | Roll back only to the exact pre-run remote SHA and only when the remote still equals the SHA pushed by this invocation; otherwise stop without changing remote history. |
| C1 | P0 | `.github/workflows/ci.yml:221-248` automatically inserts action SHAs found in workflow input through `scripts/auto-fix-shas.sh:18-53`. Membership is mistaken for provenance verification. | Unknown action SHAs fail read-only validation. Allowlist additions require a reviewed change with repository/tag/commit provenance. |
| C2 | P0 | `.github/workflows/release.yml:5-8,24-51,140-148` accepts any `v*` tag, uses `pnpm test` rather than coverage, and does not establish that the tagged SHA is a fully green commit reachable from `origin/main`. | A release-readiness job verifies tag/version agreement, main ancestry, coverage, Codacy, required checks, and scheduled cross-browser E2E for the exact SHA before production access. |
| W2 | P1 | The required invocation in `AGENTS.md:55-58` and `CONTRIBUTING.md:5-9` omits `--body`, but `scripts/atomic-commit/run.sh:66-78`, `commit.sh:57-68`, and the commit hook require one. | One canonical invocation succeeds from a fresh checkout and is tested as executable documentation. |
| W3 | P1 | Commit vocabularies drift: `CONTRIBUTING.md:13-17` permits `plans`, while `scripts/atomic-commit/commit.sh:70-76` and `scripts/hooks/commit-msg:27-50` reject it; validators also disagree on `revert`. | A single source defines valid types/scopes and table-driven parity tests run every validator. |
| W4 | P1 | `scripts/quality_gate.sh:150-238,371-386` can skip required lint, typecheck, coverage, build, smoke, or design phases and still report success. `SKIP_TESTS` also suppresses build and smoke. | The canonical full gate never exits zero when a required phase is skipped; fast/advisory modes have distinct commands and result states. |
| W5 | P1 | `scripts/validate-workflows.sh:24-44,90-128` suppresses validator installation failures and treats missing YAML, actionlint, or zizmor tooling as warnings. | Pinned, integrity-checked validators are installed separately; blocking validation fails when any required tool is unavailable. |
| W6 | P1 | `scripts/atomic-commit/verify.sh:98-108` treats zero registered CI checks after 60 seconds as success and recommends a nonexistent `--skip-ci` option. | Verification requires an explicit expected-check allowlist; zero or missing required checks fail. |
| C3 | P1 | `.github/workflows/lighthouse.yml:44-83` tolerates failed deployment, skips audits when deployment fails, and converts assertion failures to warnings. | PR Lighthouse runs against a deterministic local or preview target and fails on unavailable targets, missing reports, or failed assertions. |
| C4 | P1 | Lighthouse audits only `/reader` in the PR workflow and `/`, `/catalog`, `/admin` in release; `.lighthouserc.json:10-28` lacks auth/offline and route-specific thresholds. | Mobile Lighthouse budgets cover catalog, admin, auth, and offline routes with route-specific, blocking assertions in PR and release paths. |
| I2 | P1 | `TableOfContents.tsx:51-70,135-144` cannot mount or reveal an active chapter outside the initial virtual window; its range callback discards both arguments. | Opening the TOC and changing chapters scrolls the virtual list to any active index. |
| I3 | P1 | `VirtualList.tsx:3-14,94-123` requires uniform rows, but `CommentsPanel.tsx:229-257` applies fixed 120 px virtualization to variable-length comments and replies. | Use non-virtual rendering or measured variable-height virtualization so long comments never overlap or become unreachable. |
| I4 | P1 | Critical Worker auth/session/rate-limit paths have minimal direct test coverage: `apps/worker/src/auth/admin-middleware.ts`, `apps/worker/src/auth/session.ts`, and `apps/worker/src/lib/rate-limiter-do.ts`. | Focused tests cover expiry, revocation, role rejection, hashing, rate windows, alarms, reset, and malformed configuration. |
| C5 | P1 | `.github/workflows/ci.yml:221-248` makes initial lint advisory and reruns lint only when auto-fix succeeds. An auto-fix failure can mask lint failure. | A final lint step always runs and blocks; validation jobs do not mutate PR branches. |
| I5 | P2 | Admin recovery and note import behavior in `AdminRecoverPage.tsx` and `useImportNotes.ts` is untested in the inspected coverage report. | Tests prove recovery token handling/auth-store updates and deterministic import merge/error behavior. |
| I6 | P2 | `apps/worker/package.json:7-14` has no build/dry-run script, so root `pnpm build` does not validate Wrangler bundling and binding/migration configuration. | CI performs a deterministic, non-deploying Wrangler dry run with safe placeholder bindings. |
| I7 | P2 | `ReaderPage.tsx` is 634 lines, over the repository's 500-line source limit, and combines offline polling, EPUB lifecycle, annotation wiring, state selection, and rendering. | Extract coherent responsibilities while preserving behavior; production source files remain at or below 500 lines. |
| C6 | P2 | `.github/workflows/ci.yml:157-161` converts CodeQL API, authorization, network, or JSON failures into `0` alerts. | API failure is an explicit failure or neutral/unavailable state, never a false zero. |
| C7 | P2 | `.github/workflows/scorecard.yml:35-40` creates SARIF with publishing disabled and neither uploads nor retains it. | Scorecard results are retained or uploaded, permissions match use, and any blocking severity policy is explicit. |
| C8 | P2 | `.github/workflows/visual-regression.yml:5-9,40-48` triggers only for `packages/ui/**` and is advisory, excluding most visual changes under `apps/web/**`. | Relevant app/style/Storybook paths trigger visual regression, with an explicit blocking or approval-required policy. |
| W7 | P2 | Hook installation is manual and absent in the inspected checkout; local, CI, release, and `package.json` verification paths do not execute the same required check set. | Fresh-checkout bootstrap verifies hooks, and a machine-readable manifest proves local/CI/release gate ownership and parity. |
| C9 | P2 | Primary CI ignores documentation-only changes, including workflow policy documents, while documented commands are not executable-tested. | A lightweight required docs/policy job validates Markdown, links, agent sync, plan structure, and canonical commands. |

## Dependency Map

```text
W1 safe rollback ───────────────┐
C1 trusted SHA validation ──────┼──▶ W7 gate parity and bootstrap
W2/W3 commit contract ──────────┤
W4/W5/W6 fail-closed gates ─────┘

C2 release readiness ◀── C3/C4 Lighthouse + C5 lint + C6 CodeQL

I1 permission fix ──▶ I4 critical-flow test gate
I2 TOC behavior ────┐
I3 comment rendering ┼──▶ I7 reader decomposition
I5 recovery/import ──┘

I6 Worker dry-run, C7 Scorecard, C8 visual regression, and C9 docs CI are independent.
```

## Execution Plan

### Phase 0 — Protect shared history and supply-chain trust

1. Implement W1 before using atomic automation again.
2. Remove CI mutation from C1 and reduce lint-job permissions to read-only.
3. Add adversarial tests for concurrent remote updates and unknown action SHAs.

**Gate:** Neither test fixture can alter remote history or the SHA allowlist.

### Phase 1 — Repair the blocking engineering contract

1. Resolve W2 and W3 with one commit contract and parity tests.
2. Resolve W4 and W5 so missing/skipped mandatory checks are non-successful.
3. Resolve W6 with expected-check registration and timeout behavior.
4. Resolve C5 so lint always reaches a blocking final result.

**Gate:** Fresh-checkout and fault-injection tests prove every mandatory gate fails closed.

### Phase 2 — Close user and security behavior gaps

1. Fix I1 first because it affects permission revocation and offline data.
2. Fix I2 and I3 independently with long-list UI tests.
3. Add I4 and I5 focused tests; do not rely on aggregate coverage alone.
4. Refactor I7 only after behavior tests are green.

**Gate:** Targeted web and Worker suites pass, revoked books are removed, virtualized content remains reachable, and touched source files satisfy the line limit.

### Phase 3 — Make PR and release CI fail closed

1. Implement C3 and C4 from one shared Lighthouse route/budget definition.
2. Implement C2 and require it before production environment access.
3. Implement I6, C6, C7, C8, and C9 as independent jobs or checks.
4. Complete W7 by comparing the declared check manifest with local, PR, and release entry points.

**Gate:** Negative fixtures for unavailable services, missing reports/checks, invalid tags, unmerged SHAs, and performance regressions all fail before merge or release.

### Phase 4 — Repository-wide verification and rollout

1. Run targeted tests after each work package.
2. Run `./scripts/validate-workflows.sh` and `./scripts/quality_gate.sh` without skip variables.
3. Run Codacy PR analysis and fix all new findings.
4. Verify the worktree branch equals the PR head branch before push.
5. Verify all required checks with `gh pr checks <PR>`; do not merge on missing, pending, or failing checks.
6. Archive or cross-link generic duplicate plans only after their requirements are represented by completed work and evidence.

## Acceptance Criteria

- [ ] Revoked offline permissions clear the correct book caches using real IndexedDB semantics.
- [ ] Atomic rollback cannot overwrite concurrent remote changes.
- [ ] Unknown action SHAs cannot self-authorize through CI.
- [ ] Canonical commit documentation and every validator agree and are executable-tested.
- [ ] Mandatory local and CI gates cannot report success when skipped, missing, or unavailable.
- [ ] Long TOCs reveal the active chapter and long comments remain non-overlapping and reachable.
- [ ] Critical Worker auth/session/rate-limiter behavior has focused direct tests.
- [ ] Worker bundling and bindings receive a non-deploying CI validation.
- [ ] PR and release Lighthouse checks cover catalog, admin, auth, and offline routes with blocking mobile budgets.
- [ ] Tags cannot release commits that are unmerged, version-mismatched, or missing required green evidence.
- [ ] CodeQL API errors, missing Scorecard output, lint auto-fix failure, and missing CI checks never appear as successful validation.
- [ ] Visual and documentation-only changes receive their intended required checks.
- [ ] Full quality gate, workflow validation, Codacy, and all GitHub required checks pass before merge.

## Risks and Controls

- **Risk:** Tightening gates exposes latent failures. **Control:** Land deterministic tooling and fixtures before making checks required; never weaken thresholds to obtain green CI.
- **Risk:** Lighthouse auth/offline routes need stable state. **Control:** Create deterministic seeded/local scenarios without production secrets.
- **Risk:** Reader refactoring changes behavior. **Control:** Add behavior tests before extraction and keep refactoring separate from behavior fixes.
- **Risk:** Release API queries are unavailable on forks or restricted tokens. **Control:** Distinguish unavailable from zero and place privileged release checks only on trusted tag events.

## Definition of Done

The plan is complete only when every acceptance criterion links to a merged implementation or test, Plan 187 is accepted, all required checks pass, and no open item is represented solely by a broad audit instruction.
