# GOAP 103 — Plan Triage and Recommended Execution Order

**Date:** 2026-06-20
**Status:** In progress — triage done; execution in flight
**Author:** Swarm session 2026-06-20 (post plan 102)
**Methodology:** GOAP (analyze -> synthesize)

## Context

Following the completion of plan 102 (`feat/app-identity-responsive-e2e`,
PR #618, commit `478d0e3b`), the user requested a swarm-style mass
implementation of "all missing" plans in `plans/`. AGENTS.md Tier 1 forbids
launching mass-delegation without triage, and a single session cannot
safely implement 113 plans end-to-end with passing CI. This plan records
the triage and a recommended execution order for the next batches.

## Triage Methodology

Read every plan file in `plans/` (excluding `plans/archive/` which is
already archived) and classified each as:

- **DONE** — explicit "Status: Complete" / merged PR reference
- **IN_PROGRESS** — active work in flight
- **OPEN** — concrete unimplemented work
- **META** — ADR, retrospective, or process document
- **BLOCKED** — explicit blockers documented
- **ARCHIVED** — superseded
- **UNCLEAR** — cannot determine

## Status Totals

| Status | Count |
|--------|-------|
| DONE | 73 |
| IN_PROGRESS | 7 |
| OPEN | 0 |
| META | 32 |
| BLOCKED | 0 |
| ARCHIVED | 0 |
| UNCLEAR | 0 |
| **Total** | **112** (plus 101 closed pre-existing audit = 113 minus 1 already in `plans/`) |

Note: 73 of 113 plans are already DONE. 32 are META (ADRs/policy, not
implementation work). 7 are IN_PROGRESS, 0 are OPEN (all actionable items
have a plan owner).

## IN_PROGRESS Inventory

| # | Plan | Status | Blocker / Next step |
|---|------|--------|---------------------|
| 063 | Comprehensive codebase audit (Wave 2) | IN_PROGRESS | Wave 2 P1 items (search/export/delete/ARIA/perf budgets) |
| 065 | Reader perf + Turborepo cache | IN_PROGRESS | Stream B PR-2/PR-3 + 4 reader hot-path wins |
| 075 | 2026-06-15 swarm master plan | IN_PROGRESS | Waves B/C/D; 5 of 12 gaps still open |
| 076 | Admin recovery + book CRUD | IN_PROGRESS | Blocked on G15 (magic-link email transport) |
| 077 | Reader progress + search load (G19) | IN_PROGRESS | Single PR, dep on tenant-isolation (now merged) |
| 079 | Admin grants PATCH UI (G21) | IN_PROGRESS | Wire or delete decision |
| 084 | CHANGELOG + CONTRIBUTING sync (G27) | IN_PROGRESS | Doc-only, ready to ship |
| 100 | Coverage improvement progress | IN_PROGRESS | Phase 2 in flight; web at 76.58% vs 80% target |

## Recommended Execution Order

The next swarm should execute in this order, three PRs at a time, with
each PR isolated on its own feature branch. AGENTS.md Tier 2 coverage
gates must pass for every PR.

### Batch A — Quick wins (≤ 1 session each)

1. **084** CHANGELOG + CONTRIBUTING sync — doc-only, prerequisite for
   release-management skill; ships in < 30 min.
2. **079** Admin grants PATCH UI — decision (wire or delete) and one PR.
3. **077** Reader progress + search load (G19) — single PR; no upstream
   blocker now that tenant isolation is merged.

### Batch B — Coverage and observability (1-2 sessions)

4. **100** Coverage Phase 2 — bring web to 80%; ship unit tests for
   BooksPage, CommentItem, ReaderToolbar (the three below 50%).
5. **065** Stream B PR-2/PR-3 — startTransition + worker parse +
   chunking + perf test for reader hot path.

### Batch C — Audits and recovery (2-3 sessions, depends on G15)

6. **076** Admin recovery + book CRUD — unblock as soon as G15 ships
   (depends on 081a magic-link email transport ADR; see ADR for
   transport choice; coordinated rollout with 075 Wave B).
7. **063** Wave 2 P1 — execute the 26 P1 items, prioritized by user impact
   (search, export notes, book delete, ARIA landmarks, perf budgets,
   i18n parity). May need decomposition into a sub-plan.

### Batch D — Wave 075 / 065 closeout (1-2 sessions)

8. **075** Waves C/D — finish remaining gap items #532/#533/#534/#535/#539.
9. **065** Four reader hot-path wins — annotation adapter, reanchor
   multi-worker pool, word-set cache, sanitizer batch regex.

## Why this order

- Batch A is dependency-free, low-risk, and clears the most stale
  in-flight items. Each is ≤ 1 PR.
- Batch B addresses AGENTS.md Tier 2 coverage gate enforcement and the
  reader performance regression risk flagged in plan 065.
- Batch C requires sequencing with Batch D's reader work because the
  admin recovery flow exercises the same auth surface.
- Batch D closes the 2026-06-15 swarm; after it executes, all 7
  IN_PROGRESS plans can be marked DONE.

## Risks and Constraints

- **AGENTS.md Tier 1:** "NEVER merge with failing CI." Every PR must
  pass `gh pr checks <N>` before merge. Branch protection is currently
  not enabled on `main`, but Tier 1 still applies.
- **AGENTS.md Tier 1:** "MUST always fix pre-existing issues when
  encountered." Each PR must fix any pre-existing issue it surfaces.
- **No `--admin` bypass.** Already enforced by Tier 1.
- **Mass delegation via Jules is unproven at scale.** Pilot one
  delegation (Batch A item 2) before scaling.

## Follow-ups

- This plan is the **next** plan to execute. It is itself the swarm
  plan; it does not need a separate plan-PR until Batch A ships.
- **Plan 104 status: not needed.** The "uncommitted working-tree
  changeset" flagged earlier in this plan (AGENTS.md Tier-1 mandate,
  pnpm-lock + jsdom dep, `apps/web/src/main.tsx` `TranslationKeys`
  typing, `ReaderPage.tsx` refactor, `reader-store.test.ts`) was
  already shipped in PR
  [#617](https://github.com/d-oit/do-epub-studio/pull/617) (commit
  `7784fab`, "fix(agents): mandate pre-existing issue fixes"). When
  PR #618 was merged into `main` at `24b6cce`, the working tree
  became clean — those changes are now part of `main`. Plan 104
  is therefore not required; this finding is recorded here so
  future triage passes do not re-flag it.
- Codacy `ACTION_REQUIRED` is third-party, not a GitHub Actions check,
  and does not block merge (no branch protection). Not a plan item.

## Execution Progress

### 2026-06-20 — Plans 102 + 103 shipped in PR #618

PR [#618](https://github.com/d-oit/do-epub-studio/pull/618) merged to
main at commit `24b6cce` (squash of 4 commits: 478d0e3b, 6b96af7,
80c573b, 3d33101). Final state: 19/19 GitHub Actions pass + Codacy
pass + 0 new issues.

Lessons learned during execution (now codified in AGENTS.md, codacy
skill, security-code-auditor skill, and `agents-docs/LEARNINGS.md`):

- **Codacy IS a required check.** Treating it as "third-party /
  informational" was a false assumption — AGENTS.md Tier 1 already
  forbids merging with any failing check, and Codacy rows in
  `gh pr checks` count. Branch protection is not enabled on `main`,
  so the merge button is not technically blocked, but the policy
  applies regardless.
- **Local ESLint skips root-level configs.** The `pnpm lint` scripts
  in each workspace scope to `src/`, so `vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts` are not linted locally.
  Codacy lints the whole file. A green local `pnpm lint` is not
  sufficient; always re-check `gh pr checks` after pushing.
- **`new URL('./file', import.meta.url)` is the wrong pattern for
  repo-static files** in Vite/webpack/rollup configs because the URL
  is non-literal at the call site and trips the OWASP path-traversal
  rule (`security/detect-non-literal-fs-filename`). Use a static
  `import` (Vite/webpack/rollup config) or
  `path.join(__dirname, 'literal')` (Node). See
  `.agents/skills/security-code-auditor/SKILL.md` § "File-System
  Path Patterns" for the full patterns.
- **`?raw` import suffix does not work in `vite.config.ts`.** The
  Vite config is loaded by Node via Rolldown bundle and `?raw` is
  a Vite-only source-transform. Put the `?raw` import in a companion
  TS module and import that module's exported constant into the
  config. JSON imports work fine in the config.
- **Markdownlint MD004 (ul-style)** and **MD058 (blanks-around-tables)**
  are common gotchas that the quality gate and pre-commit hook both
  enforce. Mixing `+` and `-` for bullets, or having a table header
  followed directly by another line, both fail CI.
- **pnpm non-TTY install:** set `CI=true` env var, or
  `confirmModulesPurge: false` in `.npmrc`.
- **Stale working-tree changeset captured as plan 104** (see below).

### Updated status totals (post-102 merge)

- DONE: 74 (was 73; +1 for plan 102)
- IN_PROGRESS: 6 (was 7; -1 for plan 102)

  Remaining: 063, 065, 075, 076, 077, 079, 084, 100 (note: 084/077/079
  are Batch A and have been re-prioritized here).

### Next: Batch A execution (this plan continues)

After plan 104 is captured (next step), execute the three Batch A items
as separate PRs:

- 084 (CHANGELOG + CONTRIBUTING sync) — doc-only.
- 079 (admin grants PATCH wire-or-delete decision) — small code.
- 077 (reader progress + search load, G19) — single feature PR.

Then Batch B (100 coverage Phase 2, 065 perf), Batch C (076 admin
recovery, 063 Wave 2 P1), Batch D (075 closeout, 065 hot-path wins).
