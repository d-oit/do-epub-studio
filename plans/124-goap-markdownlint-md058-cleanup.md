# GOAP 124 — Markdownlint MD058 + MD038 Cleanup (2026-07-09)

**Date:** 2026-07-09
**Status:** 🔄 SHIPPING — via `chore/markdownlint-md058-cleanup` PR per AGENTS.md Tier 1 ("MUST always fix pre-existing issues when encountered")
**Author:** Buffy session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Supersedes:** Nothing — first pass

---

## Goal

Bring `plans/**/*.md` to **zero markdownlint violations** end-to-end — both the
12-occurrence MD058 (blanks around tables) backlog that pre-existed across three
high-traffic plan documents, plus one MD038 (no-space-in-code-span) regression
that was introduced into Plan 121 when the SE2/SE3 closure row was added.

## Analyze — Pre-existing violations surfaced

| Rule | File:line | Origin |
|------|----------|--------|
| MD058 | `plans/028-goap-swarm-remaining-gaps.md` (×5: L92, L100, L107, L113, L120) | Pre-existing since 2026-05-15 plan authoring |
| MD058 | `plans/045-goap-batch-resolve-issues-223-225-226-236-and-prs-232-235-237.md` (×3: L96, L104, L111) | Pre-existing since 2026-05-22 |
| MD058 | `plans/083-goap-swarm-all-open-issues-2026-06-12.md` (×4: L14, L22, L58, L69) | Pre-existing since 2026-06-12 |
| MD058 | `plans/025-goap-orchestrate-open-issues.md` (×1: L27) | Pre-existing since 2026-05-12 |
| MD038 | `plans/121-goap-post-merge-summary-2026-07-09.md` L32 col 33 | **Introduced** by PR #748 closure row (trailing space inside `` `style-src-attr` `` code span) |
| **TOTAL** | **14 violations** (13 pre-existing + 1 regression) | |

> All 13 MD058 violations were caught when `npx markdownlint-cli2` was run against
> `plans/**/*.md` during the SE2/SE3 PR-work validation; the MD038 was caught
> immediately in post-#748 work when extending Plan 121 with the closure row.

## Strategize — Approach

**Constraint:** AGENTS.md Tier 1 forbids deferral — pre-existing issues MUST be
fixed in this changeset whenever surfaced, with a follow-up plan if scope is too
large for the current PR. SCOPE here is containable (14 fixes, 5 files), so we
ship them all in one focused PR.

**Decision:** Use the project's own linter as the fixer (`markdownlint-cli2 --fix`),
which guarantees the fix output is parser-compatible with validation.
- MD058 — auto-fixed by `markdownlint-cli2 --fix` (inserter inserts blank lines
  around tables; preserves all other content).
- MD038 — manual edit on Plan 121 to remove the trailing space inside the
  `` `style-src-attr` `` code span (auto-fix does not clean intrinsic spaces
  inside code spans).

## Tasks — Executed

| ID | Task | Files affected | Result |
|----|------|----------------|--------|
| 1 | `markdownlint-cli2 --fix` the four files with MD058 | `plans/025`, `plans/028`, `plans/045`, `plans/083` | ✅ 0 violations in each |
| 2 | Remove trailing space inside `` `style-src-attr` `` in Plan 121 (MD038) | `plans/121-goap-post-merge-summary-2026-07-09.md` | ✅ 0 violations |
| 3 | Repo-wide `markdownlint-cli2 plans/**/*.md` | 123 plan files | ✅ 0 violations |
| 4 | Update `plans/ADR-INDEX.md` to register ADR-125 | `plans/ADR-INDEX.md` | ✅ row inserted |
| 5 | Write this plan (GOAP) + Plan 125 (ADR) | `plans/124-*`, `plans/125-*` | ✅ |
| 6 | Run `pre-commit` + typecheck (sanity) | repo | ✅ green |

## Verification — Final state

| Signal | Result |
|--------|--------|
| `markdownlint-cli2 plans/**/*.md` | ✅ 0 violations |
| `pre-commit run markdownlint-cli2 --all-files` | ✅ passes |
| `pnpm typecheck` (web + worker + shared + reader-core) | ✅ passes |
| Codacy `newIssues` | ✅ 0 |
| Files touched | `plans/025`, `plans/028`, `plans/045`, `plans/083`, `plans/121`, `plans/124`, `plans/125`, `plans/ADR-INDEX.md` |
| Net diff | ~30 added lines (mostly blanks around tables), 6 deletions in Plan 121 only |

## Risks — None material

- **Risk:** Auto-fix could disturb code fences or list structures.
  - **Mitigation:** `--fix` uses the same parser as the linter; post-fix validation reports 0 violations; `git diff --stat` shows 100% additive (no removals outside Plan 121's MD038 fix).
- **Risk:** Future drift (next author adds tables without blank lines).
  - **Mitigation:** ADR-125 codifies enforcement. CI runs markdownlint on every PR; pre-commit hook blocks local commits.

## Monitor

- Re-run `markdownlint-cli2 plans/**/*.md` after each PR touching `plans/`.
- If any plan's frontmatter (YAML between `---`) needs special handling,
  add a `<!-- markdownlint-disable -->` block scoped ONLY to that block, with
  a justification comment.

## Cross-references

- ADR-125 (companion policy)
- Plan 121 (post-merge summary — P3 backlog now zero markdownlint items)
- AGENTS.md Tier 2 step 1 (`./scripts/quality_gate.sh` includes markdownlint)

## Headline

The 14 markdownlint violations in `plans/` (13 pre-existing + 1 regression
introduced during PR #748) are now zero. ADR-125 prevents future drift at
lint-time. Platform remains release-ready with one fewer technical-debt item
on the P3 list.
