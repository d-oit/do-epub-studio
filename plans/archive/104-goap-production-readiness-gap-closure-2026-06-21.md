# GOAP 104 — Production-Readiness Gap Closure (Identity, Versioning, Features, Docs, Workflow, Harness)

**Date:** 2026-06-22
**Status:** ✅ MERGED (PR #624, commit `6432c3b`) — execution record at
`plans/104-goap-execution-record-2026-06-22.md`
**Author:** Analysis session 2026-06-21 (post plan 103 triage)
**Branch (proposed):** `feat/production-readiness-104`
**Related ADR:** `plans/104-adr-product-identity-and-version-governance.md`
**Extends:** ADR-102 (app identity/version), plan 103 (triage)
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)

## Goal

Bring `d.o.EPUB Studio` to a coherent production-ready state by closing the
gaps that block a clean `0.x` release: (1) a **unique, consistent product
identity** and (2) **version governance**, plus the remaining
**feature**, **documentation**, **coding-workflow**, and **test/CI
harness** gaps surfaced during analysis. This plan is documentation-only;
it records the analysis and a decomposed, sequenced execution plan. No
code is changed by this plan — each task below ships as its own PR.

## Analysis

### What is already solid (do not re-do)

Per plan 103 triage: 74 plans DONE, 32 META, 0 OPEN-without-owner. The
stack (React 19 / Vite 8 / Workers / Turso / R2), security posture
(Argon2id, signed URLs, CSP, ReDoS guards, tenant isolation), offline
sync, multi-signal locators, CI/CD, and observability are implemented and
documented. ADR-102 already made the **web** name/version single-sourced.

### Gap clusters found on 2026-06-21

#### Cluster 1 — Product identity is inconsistent (NEW)

Canonical name is `d.o.EPUB Studio` / `d.o.EPUB`
(`apps/web/src/config/app-identity.json`), but the repo carries at least
five divergent spellings (see ADR-104 table). Concrete offenders:

| File | Current | Should be |
|---|---|---|
| `README.md:1` | `# d.o. ePUB Studio` | `# d.o.EPUB Studio` |
| `packages/ui/src/AppLogo.tsx:15` | `aria-label="do EPUB Studio logo"` | `d.o.EPUB Studio logo` |
| `packages/ui/src/__tests__/components.test.tsx:35` | `do EPUB Studio logo` | `d.o.EPUB Studio logo` |
| `packages/ui/src/__stories__/Header.stories.tsx:20,35` | `EPUB Studio` | `d.o.EPUB Studio` |
| `apps/worker/src/routes/admin/auth.ts:112` | `Recover access to EPUB Studio Admin` | `…to d.o.EPUB Studio Admin` |
| `apps/web/README.md:3`, `apps/worker/README.md:3`, `packages/testkit/README.md:3` | `EPUB Studio` | `d.o.EPUB Studio` |
| `docs/coding-guide.md` (≈6 hits incl. `VITE_APP_NAME=do EPUB Studio`) | `do EPUB Studio` | `d.o.EPUB Studio` |
| `docs/setup-local.md:3`, `docs/reading-insights.md:31` | `EPUB Studio` | `d.o.EPUB Studio` |

No lint guard prevents regressions. (Generic "EPUB file/reader" usage is
fine — see ADR-104 §5.)

#### Cluster 2 — Version drift (NEW)

`VERSION` = `0.1.0`; all 7 `package.json` = `0.1.0`; but `CHANGELOG.md`
already ships `## [0.1.1] - 2026-06-14` plus a populated `[Unreleased]`.
The runtime advertises `0.1.0` while `0.1.1` released → ADR-104 §8
violation. No guard enforces `VERSION` ↔ `package.json` ↔ changelog parity.

#### Cluster 3 — Feature gaps (carried from in-flight plans)

From plan 103 IN_PROGRESS inventory (still open):

- **Plan 076 / G15** — admin recovery + book CRUD, blocked on magic-link
  email transport (ADR-081 `081-adr-magic-link-email-transport.md`).
- **Plan 063 Wave 2** — 26 P1 items: in-book search polish, export notes,
  book delete, ARIA landmarks, perf budgets, i18n parity.
- **Plan 075 Waves C/D** — 5 of 12 gaps open (#532/#533/#534/#535/#539).
- **Plan 065** — reader hot-path perf wins + Turborepo cache (Stream B
  PR-2/PR-3 + 4 reader optimizations).

#### Cluster 4 — Documentation gaps

- `docs/coding-guide.md` carries the wrong product name and a stale
  `VITE_APP_NAME` env example (ADR-102 removed env-based naming).
- `docs/release-process.md` says "CHANGELOG auto-generated, never edit"
  but the changelog is hand-edited and `VERSION` wasn't bumped —
  reconcile with the `release-management` skill (ADR-104 §9).
- Per-package READMEs (`apps/web`, `apps/worker`, `packages/testkit`)
  use the non-canonical name and should cross-link the identity ADR.

#### Cluster 5 — Coding-workflow gaps

- No `scripts/check-app-identity.mjs` guard (ADR-104 §11) wired into
  `quality_gate.sh` to catch naming/version drift.
- Identity/version invariants are not asserted in the workflow the way
  ADR-083's `check-adr-index.mjs` asserts ADR numbering.

#### Cluster 6 — Harness (test/CI) gaps

- Plan 100 — web unit coverage 76.58% vs 80% target; BooksPage,
  CommentItem, ReaderToolbar below 50%.
- No test asserts cross-surface name parity (Worker email subject, UI
  logo, Storybook) against `app-identity.json`.
- No test asserts `VERSION` ↔ `package.json` parity.

## Decomposition

| ID | Task | Cluster | Priority | Deps | Owner skill |
|----|------|---------|----------|------|-------------|
| T1 | Normalize all product-name spellings to `d.o.EPUB Studio` per ADR-104 | 1 | P0 | ADR-104 | reader-ui-ux + code-quality |
| T2 | Add `scripts/check-app-identity.mjs` (name + version parity guard); wire into `quality_gate.sh` | 5,6 | P0 | T1 | shell-script-quality + agents-md |
| T3 | Reconcile `VERSION`/`package.json`/CHANGELOG; bump to released `0.1.1` (or cut next) via `release-management` skill | 2 | P0 | ADR-104 | release-management |
| T4 | Fix docs: `coding-guide.md` name + drop stale `VITE_APP_NAME`; reconcile `release-process.md`; update per-package READMEs | 4 | P1 | T1,T3 | agents-md |
| T5 | Add parity tests (UI logo, Worker email, Storybook ↔ `app-identity.json`; `VERSION` ↔ `package.json`) | 6 | P1 | T1,T2 | testing-strategy |
| T6 | Plan 100 — raise web coverage to 80% (BooksPage, CommentItem, ReaderToolbar) | 6 | P1 | none | testing-strategy + testdata-builders |
| T7 | Plan 076 / G15 — magic-link email transport → unblock admin recovery + book CRUD | 3 | P1 | ADR-081 | secure-invite-and-access |
| T8 | Plan 063 Wave 2 — 26 P1 feature items (decompose into sub-plan) | 3 | P2 | T7 | goap-agent (sub-plan) |
| T9 | Plan 065 — reader hot-path perf + Turborepo cache | 3 | P2 | none | epub-rendering-and-cfi |
| T10 | Plan 075 Waves C/D — close #532/#533/#534/#535/#539 | 3 | P2 | T7 | goap-agent |

**Principles:** each task is atomic, testable, and shippable as its own
PR with passing Tier-2 gates. T1–T5 are the identity/versioning/harness
core that this plan introduces; T6–T10 fold in the already-tracked
in-flight plans so production-readiness is tracked in one place.

## Strategy

Hybrid: a sequential **foundation wave** (identity + versioning + guard +
docs + parity tests) followed by **parallel feature/coverage waves**.

### Decision tree applied

- T1→T2→T5 are dependent (normalize, then guard, then test) → sequential.
- T3 (version) is independent of T1 but shares the release PR cadence.
- T6–T10 are mutually independent feature/coverage tracks → parallelizable
  across sessions once the foundation lands.

## Execution plan

### Wave 1 — Identity & Version foundation (1 PR, P0)

- Tasks: **T1, T2, T3**.
- Quality gate: `scripts/check-app-identity.mjs` passes; full
  `./scripts/quality_gate.sh` green; `gh pr checks` incl. Codacy green.
- Exit: zero disallowed spellings; `VERSION` == `package.json` == highest
  released changelog version; runtime shows correct version.

### Wave 2 — Docs & parity tests (1 PR, P1)

- Tasks: **T4, T5**.
- Quality gate: docs markdownlint clean; new parity tests pass; coverage
  thresholds unaffected.

### Wave 3 — Coverage (1 PR, P1)

- Task: **T6** (plan 100 Phase 2). Web → 80% lines.

### Wave 4 — Features (parallel, P1→P2, multiple PRs)

- Tasks: **T7** (unblocks **T10**), then **T8**, **T9** in parallel.
- Each gated by Tier-2 coverage + Codacy. T8 needs its own decomposition
  sub-plan (26 items) before execution.

## Quality gates (every PR)

- `./scripts/quality_gate.sh` (lint, typecheck, unit+coverage, build,
  e2e smoke, shellcheck, workflow/link validators).
- `gh pr checks <N>` all green **including Codacy** (AGENTS.md Tier 1).
- Any pre-existing issue surfaced is fixed in the same PR (AGENTS.md
  Tier 1) or gets a linked follow-up GOAP + ADR + tracking issue.

## Risks and constraints

- **Test fixtures assert the old names** (`components.test.tsx`,
  `Header.stories.tsx`) — T1 must update them in lockstep or CI breaks.
- **Worker email-subject change** is user-visible copy; coordinate with
  any e-mail snapshot tests.
- **Version bump path** must go through `release-management` skill — no
  manual tags or direct CHANGELOG edits (AGENTS.md Tier 2 rule 9).
- **T8 is large (26 items)** — do not delegate as a single Task; decompose
  first.
- Build artifacts under `apps/web/dist/**` carry stale names; they are
  generated, excluded from the guard, and regenerate on build.

## Definition of done (production-ready slice)

- [ ] One product spelling repo-wide (`d.o.EPUB Studio` / `d.o.EPUB`).
- [ ] `VERSION` ↔ `package.json` ↔ changelog in sync; runtime shows it.
- [ ] Identity/version guard wired into the quality gate.
- [ ] Parity tests for name and version pass.
- [ ] Docs (coding-guide, release-process, package READMEs) reconciled.
- [ ] Web coverage ≥ 80%.
- [ ] Plans 076/063/075/065 feature gaps closed or carried with linked
      sub-plans.

## Synthesis

To be completed after Wave 1 ships. This plan supersedes the identity/
version follow-ups noted in plan 102's "Follow-ups" and folds the
remaining in-flight feature/coverage plans (063, 065, 075, 076, 100) into
a single production-readiness tracker per plan 103's recommended order.
