# GOAP-1005: PR roast sweep — all open PRs reviewed, zero-impact closed, impactful merged

**Status:** DONE (2026-10-09; follow-up executed 2026-10-10)
**Date:** 2026-10-09
**Type:** Repository hygiene sweep — skill `pr-roast-batch-close`, orchestrated per
`goap-agent` (analyze → decompose → strategize → execute → synthesize)
**Repo:** `d-oit/do-epub-studio` — scanned at main @ `d42d2647`, merged into main
as `4f0bbeae`
**Isolation:** all rebase/merge work ran in the git worktree `/tmp/pr-roast/wt`
(removed after use); the primary checkout (`fix/restore-stale-base-reverts`,
dirty) was never touched.

## Goal

Review all 3 open PRs, roast each for codebase impact (0–10 rubric from the
skill), close zero-impact PRs, address the roast recommendations on impactful
ones, and merge them in the deterministic order defined by
`skill://pr-roast-batch-close/references/merge-order.md` (overlap degree asc →
changedFiles asc → createdAt asc), each PR rebased onto the latest `main` and
gated on green required checks (never `--admin`, never `--auto` — AGENTS.md
Tier 1).

## Acceptance criteria — outcome

- Roast report covering every open PR with score + decision. ✔
- Zero-impact PR closed: **#1285 closed 2026-10-09**. **#1294** (score 2/10)
  was closed 2026-10-10T08:10Z under the standing zero-impact-close directive,
  then **reopened and merged** the same morning on the owner's explicit
  instruction ("merge when all ci pass — ignore chromatic ui tests for now")
  after its two message checks were fixed and all CI went green → `65685ac5`. ✔
- Impactful PR: **#1297** — recommendations addressed, rebased, required checks
  green, squash-merged as `4f0bbeae`. ✔
- Progress recorded here. ✔

## Phase 1 — Dossier (`collect`)

| PR   | Title                                                                                              | Created    | Δ       | Files | Labels                    | mergeState (at scan) |
| ---- | -------------------------------------------------------------------------------------------------- | ---------- | ------- | ----- | ------------------------- | -------------------- |
| 1297 | `feat(ux): enhance ProgressBar accessibility with aria-valuetext and value clamping`               | 2026-10-09 | +24/−6  | 2     | `tests`, `area:ui`        | BEHIND               |
| 1294 | `perf(reader-core): optimize attribute sync and eliminate array allocations in document sanitizer` | 2026-10-07 | +37/−42 | 2     | `security`, `area:reader` | BEHIND               |
| 1285 | `ci: verify main branch CI failure resolution (run 37285259054)`                                   | 2026-10-06 | +0/−0   | 0     | —                         | BEHIND               |

Required status checks (branch protection, `strict: true`): `pr-title`,
`commit-range`, `PR Gate (all paths)`, `Full Quality Gate`, `Pre-commit Hooks`,
`CodeQL Alert Check`.

CI failure triage (all three PRs were red before this sweep):

- `pr-title` (1297): 82 chars > 72 (`scripts/hooks/commit-msg --subject-only`).
- `commit-range` (1297): first commit `0aa6a25d` subject 82 chars > 72.
- `pr-title` (1294): 96 chars > 72.
- `commit-range` (1294): tip commit `2292bbaac9` subject 96 chars > 72.
- `commit-range` (1285): commit `99c5ad45` has no body.
- `E2E Smoke Tests` (1294) showed `fail` but the job was `cancelled`
  (concurrency supersede) — infra noise, not a code failure.
- Chromatic `UI Tests` (1297) is `pending` ("70 changes must be accepted as
  baselines") — a repo-wide, human-gated baseline backlog, non-required.

No unresolved review threads on any PR (GraphQL `reviewThreads`).

## Phase 2 — Impact scoring

### PR #1285 — **0/10 — CLOSED**

Zero diff (0 files, +0/−0; the four commits are empty re-trigger commits), the
issue it links (`Fixes #1281`) is already CLOSED, and its own `commit-range`
check fails (no body). Close conditions hit: only non-code changes / no
functional change / failing CI. Closed via the skill script with the roast
comment.

### PR #1294 — **2/10 — CLOSE RECOMMENDED (manual; `security` label)**

**The Roast:** a "perf" PR whose savings are unmeasurable by the repo's own
benchmark and which quietly deleted the why-comments documenting the epub.js
interop contracts it touches.

Evidence (repo's own `packages/reader-core/src/sanitizer.bench.ts`, two paired
runs, main `d42d2647` vs the PR head, mean ms):

| bench                          | main r1 | main r2 | PR r1  | PR r2  |
| ------------------------------ | ------- | ------- | ------ | ------ |
| `sanitizeEpubDocument` 500 el  | 50.12   | 50.02   | 50.11  | 55.67  |
| `sanitizeEpubDocument` 2000 el | 322.48  | 328.18  | 329.45 | 349.76 |
| `sanitizeEpubDocument` 5000 el | 2030.0  | 1971.9  | 2017.9 | 2000.7 |
| `sanitizeDom` 2000 el          | 28.60   | 27.47   | 30.07  | 28.68  |

All deltas are inside the reported rme (±1.4–9.2 %); the only consistent
direction is marginally slower. Structurally the change cannot matter: it saves
~5 small allocations per call in front of DOMPurify's per-call traversal of the
full element tree and its own per-call `ALLOWED_ATTR` set rebuild
(`purify.cjs.js:1387 addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, …)`); the touched
collections are `root.attributes` (2–3 attrs) and `sanitized.childNodes`
(head+body).

Safety findings (verified, no correctness bug): DOMPurify only _reads_
`ADD_ATTR` → hoisting `EPUB_ADD_ATTR` is safe; `querySelectorAll` returns a
static NodeList → dropping `Array.from` is safe; backwards attribute removal
keeps indices valid; the HIT-path cache re-parses serialized HTML → moving
nodes out of `cachedRoot` is safe. Host-node preservation is covered by
`sanitizer.test.ts:745–780`; `reader-core` suite green on the head
(491 passed).

Negative findings: four why-comments deleted (epub.js `head.removeChild`
interop, GOAP-224 C14 cache-HIT/MISS `<html>` attribute parity, policy
semantics); return type widened to `NodeListOf<Element> | Element[]`; no perf
numbers attached; `pr-title` + `commit-range` red. Full evidence posted as a
COMMENTED review on the PR (2026-10-09).

### PR #1297 — **7/10 — APPROVED (post-fix) and MERGED**

**The Roast:** fixes a real ARIA contract violation — `aria-valuenow` outside
`[aria-valuemin, aria-valuemax]` (WAI-ARIA APG: the value must be in range) —
while the old unit test asserted the buggy behaviour under the lying name
"clamps value between 0 and 100".

Impact: `BookCard` feeds `progressPercent` from `useEpubProgress.ts`
(`location.start.percentage * 100`); epub.js fractions can drift out of
`[0, 1]`, and the visual bar was clamped while `aria-valuenow` was not, so
screen readers announced values like `-10` or `200`. The PR clamps the value,
derives the percentage from the clamped value (with a `max > 0` guard), and
adds `aria-valuetext` (explicit prop, or formatted percentage when
`showValue`), with tests for clamping, custom text and the `showValue`
fallback.

Recommendations (all addressed before merge): retitle to ≤ 72 chars;
re-message the offending commit with a WHY body; rebase onto latest `main`.

## Phase 4 — Execute (results)

| PR   | Action                                       | Result                                                                                                                             |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1285 | close with roast comment                     | **CLOSED** 2026-10-09T19:21Z (skill script, `--execute`)                                                                           |
| 1294 | roast comment → close → reopen + fix + merge | COMMENTED review 2026-10-09; CLOSED 2026-10-10T08:10Z; **REOPENED + MERGED** 2026-10-10T09:06Z as `65685ac5` per owner instruction |
| 1297 | retitle + re-message + rebase + push + merge | **MERGED** 2026-10-09T19:30Z as `4f0bbeae`                                                                                         |

Merge order (skill rule): only #1297 remained in the merge set, so the order
was trivially `1297`. (Had #1294 been merged too, it would have gone first:
same overlap degree 0, same changedFiles 2, older createdAt.)

### PR #1297 execution detail

1. Worktree `/tmp/pr-roast/wt`, branch `pr-roast-1297` from the PR head.
2. Interactive rebase onto `origin/main`: reworded the first commit
   (`0aa6a25d` → `feat(ux): clamp ProgressBar value and add aria-valuetext`,
   body explaining WHY) and dropped the three empty follow-up commits Jules had
   added → single commit `ef58adca`.
3. Content-preservation proof: `git diff origin/main...HEAD` byte-identical
   before/after the rebase (`PATCH-IDENTICAL`).
4. Local simulations of both failing checks: full hook passes on the commit
   (`commit-range`), `--subject-only` passes on the new title (`pr-title`).
5. `packages/ui`: `test:unit` 150/150, `lint --max-warnings 0` clean,
   `tsc --noEmit` clean.
6. PR title + body rewritten (`gh pr edit`), force-push to the PR head branch.
7. All required checks green (`pr-title`, `commit-range`, `PR Gate (all paths)`,
   `Full Quality Gate`, `Pre-commit Hooks`, `CodeQL Alert Check`), plus
   `Codacy Static Code Analysis`, `bot-repush-guard`, Build Node 22/24,
   Chromatic visual regression. The only non-pass item was the non-required
   Chromatic `UI Tests` check pending on the repo-wide 70-baseline backlog
   (unchanged by this PR); the skill's CI gate aborts only on `fail`, so the
   merge proceeded. `mergeStateStatus: UNSTABLE`, `mergeable: MERGEABLE`,
   0 unresolved threads.
8. `gh pr merge 1297 --squash` → main `4f0bbeae`.

### 2026-10-10 follow-up

- Re-verified #1294 against the refreshed head (`f8e8ad64`, main merged in after
  `#1300`) — no code change (`+37/−42`, 2 files), `pr-title` + `commit-range`
  still red; the 10-09 roast therefore still holds. Closed with the evidence
  comment under the owner's standing zero-impact-close directive.
- Independent checks: **0 open Dependabot alerts** (alert #60 fixed by `#1300`);
  main CI/CodeQL/Scorecard green at `9965f384`.
- Result: **0 open PRs** in the repository.

### 2026-10-10 — #1294 reopened and merged (owner instruction)

Owner policy for this pass: _merge when all CI passes; ignore Chromatic UI
Tests_ (the non-required Chromatic baseline queue must not gate merges).

1. `gh pr reopen 1294` + plan comment.
2. Worktree rebase onto `origin/main`: reworded the oldest commit
   (`2292bbaa` → `perf(reader-core): cut sanitizer allocations in attribute
sync`, WHY body), rewrote the PR title to match (61 chars), dropped the
   three content-empty commits and the two main-merge commits (all `Merge …`
   commits are hook-exempt) → 3 commits, with a `PATCH-IDENTICAL` proof against
   the pre-rebase three-dot diff.
3. Local proof: commit-range simulation passes on all 3 commits; `pr-title`
   hook passes on the new title; `reader-core` suite 491 passed;
   `check-loc.mjs` green.
4. Push → all checks settled green. `Benchmark` first reported a _false_
   regression (`sanitizeEpubDocument (5000 el)` −20.99 % while untouched
   benchmarks also "regressed" −14…−18.7 %); local paired benchmarks showed no
   difference, so the job was re-run and passed → runner noise, not the PR.
5. `mergeStateStatus: CLEAN`, 0 unresolved threads → `gh pr merge 1294 --squash`
   → main `65685ac5` (hook-valid subject + body).
6. Note: the roast verdict (2/10, no measurable gain) is unchanged; the merge is
   per owner instruction. The deleted why-comments remain deleted — restoring
   them is an optional follow-up.

### Repo-health observations (2026-10-10)

- `Dependency Vulnerability Scan` failures on main's post-merge CI runs for
  #1297/#1299 were the vulnerable sub-dependencies, fixed by `#1300` (main
  `9965f384`); **0 open Dependabot alerts** now.
- `Benchmark` is flaky on GitHub runners: the 20 % regression threshold trips on
  unrelated benchmarks too; re-running the job cleared it. Candidate for
  threshold/noise hardening (separate task).
- `Scheduled Cross-browser E2E` (main, run 38037282055) fails in infra: the Vite
  dev server's `/api` proxy gets `ECONNREFUSED 127.0.0.1:8787` (no dev API
  backend in the scheduled job). Pre-existing, unrelated to this sweep; needs
  its own fix.

## Verification

- Benchmarks: 2 paired runs of `packages/reader-core/src/sanitizer.bench.ts`
  (vitest bench, jsdom), main vs #1294 head — no measurable difference.
- Tests: `reader-core` 491 passed on #1294 head; `packages/ui` 150/150 on the
  rebased #1297 head; lint + typecheck clean.
- Merge results: `origin/main` contains the clamped implementation
  (`progress-bar.tsx:` `clampedValue`, `aria-valuenow={clampedValue}`,
  `aria-valuetext`); the squash commits `4f0bbeae` (#1297) and `65685ac5`
  (#1294) both carry hook-valid subjects + bodies.
- Real-browser smoke (Storybook dev server + headless Chromium):
  `WithValue` story renders `aria-valuenow=60 / aria-valuemin=0 /
aria-valuemax=100 / aria-valuetext="60%"`; `Default` story renders
  `aria-valuenow=50` with **no** `aria-valuetext` (conditional works);
  zero console errors on the story page.
- Cleanup: worktree removed, scaffolding branches deleted; primary checkout
  untouched.

## Follow-ups

1. ~~#1294 disposition~~ — **closed 08:10Z, then reopened and merged 09:06Z** as
   `65685ac5` per owner instruction (see the 10-10 log). Optional follow-up:
   restore the why-comments the PR deleted (epub.js re-home contract, GOAP-224
   C14 parity).
2. ~~Dependabot alert #60~~ (`sharp`, high — librsvg CVE-2026-96889) — resolved
   by `#1300` (`fix(security): patch vulnerable sub-dependencies in pnpm
overrides`, main `9965f384`); re-checked 2026-10-10: **0 open alerts**.
3. **Chromatic baseline backlog** (70 pending changes) needs a human accept/
   reject pass in Chromatic. Per owner instruction (2026-10-10) it must **not**
   gate merges ("ignore chromatic ui tests for now"); it still keeps the
   non-required `UI Tests` check pending on UI PRs.
