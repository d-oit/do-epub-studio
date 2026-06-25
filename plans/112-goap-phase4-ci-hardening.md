# GOAP 112 — Phase 4 CI Hardening (Bundle Budget, Impeccable Wiring, Lint Completeness)

**Date:** 2026-06-25
**Status:** IN PROGRESS
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** ADR-107 (Quality Gate Escalation), ADR-111 (Impeccable Design Vocabulary), ADR-112 (CI Hardening)
**Extends:** Plan 107 (Quality/DX improvements), Plan 111 (Impeccable wire-in)

## Goal

Close three CI hardening gaps in one change set:

1. Impeccable detector is fully wired into the default quality gate as a
   non-blocking `::warning::` summary (with `IMPECCABLE_REQUIRED=1` escalation).
2. Bundle-size budget is enforced in CI using gzipped thresholds from
   ADR-107 §3 (180 KB main JS / 30 KB main CSS / 80 KB per lazy chunk).
3. `markdownlint` + `zizmor` run by default in the quality gate
   (no env flag required).

## Analysis — Current State

| Sub-task | Pre-state | Gap |
|----------|-----------|-----|
| 1. Impeccable wiring | `scripts/quality_gate.sh` invokes `run-impeccable.sh`. The script itself emits `::warning::` for findings and `::error::` only when `IMPECCABLE_REQUIRED=1`. | The gate did not forward the `IMPECCABLE_REQUIRED` env var; the block was also missing the ADR-111 §2 inline comment. |
| 2. Bundle budget | `scripts/check-bundle-size.mjs` exists; reads `.performance-budgets.json` with raw byte thresholds. `ci.yml` runs it inside `build`. The `apps/web/package.json` has `test:bundle`. | Thresholds are raw bytes, not gzipped KB per ADR-107 §3. No standalone `bundle:budget` script. No dedicated workflow gated on web/ui paths. |
| 3. markdownlint + zizmor in default gate | `scripts/quality_gate.sh` invokes `validate-workflows.sh` which already runs `zizmor --min-severity medium`. `markdownlint` runs in the markdown section. | Inline comments documenting the "default" status were missing; risk of future env-gating regressions. |
| 4. KNOWN-ISSUES.md | File already contains monitor-tier entries (Windows symlinks, Playwright browser install, Lighthouse thresholds). | None — verified. No contradictory state. |

## Decomposed Tasks

### Sub-task 23 — Impeccable gate step honours `IMPECCABLE_REQUIRED`

- Add inline comment documenting ADR-111 §2.
- Forward `IMPECCABLE_REQUIRED` env var into the wrapper script invocation.
- Keep the `if ! ...` guard so the gate still blocks on the (rare) required-with-findings path.

### Sub-task 24 — `bundle:budget` script + workflow

- Create `scripts/check-bundle-budget.mjs`:
  - Walks `apps/web/dist/assets/*.{js,css}` (and any nested dirs).
  - Measures **gzipped** size (KB) via `zlib.gzipSync`.
  - Compares against thresholds from ADR-107 §3.
  - Fails (exit 1) when `BUNDLE_BUDGET_FAIL_ON_VIOLATION=1`.
  - Writes markdown report when `BUNDLE_BUDGET_REPORT` is set.
- Add `bundle:budget` + `bundle:budget:enforce` scripts to `apps/web/package.json` and the root `package.json`.
- Create `.github/workflows/bundle-size.yml` triggered on PRs touching `apps/web/**`, `packages/ui/**`, `packages/reader-core/**`, `packages/shared/**`, the script, the vite config, or itself.
- Add 5 unit tests under `scripts/__tests__/check-bundle-budget.test.mjs`.

### Sub-task 25 — markdownlint + zizmor default gate verification

- Add inline comments to `quality_gate.sh` marking these steps as
  default-gate (no env flag), so future refactors do not regress.
- Update `scripts/README.md` tool table + env-var table to document
  `IMPECCABLE_REQUIRED`, `SKIP_DESIGN`, `BUNDLE_BUDGET_*`.

### Sub-task 26 — KNOWN-ISSUES.md verification

- File is monitor-tier only. No edits by this PR (per AGENTS.md
  "no direct KNOWN-ISSUES.md edits by feature PRs — they cite a GOAP plan + ADR").
- Pre-existing `admin-route-*.js` violation (>80 KB gz lazy chunk) is
  recorded as a follow-up below.

## Pre-existing Issue Discovered (AGENTS.md TIER-1)

Running `node scripts/check-bundle-budget.mjs apps/web/dist` against the
main tree surfaces a **pre-existing** `admin-route-*.js` lazy-chunk
violation (`128.78 KB gz` > `80 KB` per ADR-107 §3). The
`bundle:budget` script reports it as a warning by default and does not
block the gate. The `bundle-size.yml` workflow **does** enforce via
`BUNDLE_BUDGET_FAIL_ON_VIOLATION=1` so the next PR that grows the chunk
will see a red CI. Follow-up: split the admin route into per-page
chunks (BooksPage, CatalogPage, RecoverPage, AuditLogPage). Tracked as
a separate item.

## Strategy

- Single PR with sub-tasks 23-26 wired together.
- Branch: `feat/phase4-ci-hardening`.
- Sequential execution. Each sub-task validated independently.

## Quality Gates

- [x] `node scripts/check-bundle-budget.mjs apps/web/dist` exits 0 with
      a clear table including the pre-existing admin-route warning.
- [x] `pnpm vitest run scripts/__tests__/check-bundle-budget.test.mjs`
      reports 5/5 passing.
- [x] `validate-workflows.sh` passes for the new `bundle-size.yml`.
- [x] `run-impeccable.sh` exits 0 in default mode and exits 1 with
      `IMPECCABLE_REQUIRED=1` when findings > 0 (forwarded through
      `quality_gate.sh`).
- [x] `quality_gate.sh` no longer requires env vars to enable
      markdownlint or zizmor.

## Success Criteria

- [ ] PR is opened against `main` from `feat/phase4-ci-hardening`.
- [ ] `gh pr checks` is green for all required checks (Codacy green).
- [ ] Follow-up tracking issue exists for the admin-route chunk split.
