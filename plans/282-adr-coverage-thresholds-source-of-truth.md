# ADR-282: Coverage thresholds get one machine-readable source of truth

**Date:** 2026-09-24
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-276 (P0 #5), ADR-022 (coverage/benchmark infra — provenance of the `codecov.yml` fossil), AGENTS.md Tier 1 (fix pre-existing issues on touch), Tier 2 #4, ADR-083 (numbering), ADR-278 (gate-phase wiring pattern)

## Context

The per-package coverage floors were recorded in four places that disagreed three ways:

1. **The seven `vitest.config.ts` files** — the live, CI-gated truth. `test:coverage`
   runs inside `quality_gate.sh` and CI with these numbers as hard vitest
   `coverage.thresholds`, so CI cannot be green below them. This layer also
   enforces `branches` and `statements` floors that no document mentioned.
2. **`codecov.yml`** — a fossil. `plans/archive/022-adr-coverage-and-benchmarking.md`
   recorded web 40 / worker 55 / shared 25 / reader-core 75 as _the AGENTS.md
   values of that day_ and instructed "create `codecov.yml` matching AGENTS.md";
   `plans/archive/223-*` later corrected worker upward in AGENTS.md, but
   `codecov.yml` was never updated. It also had no schema/testkit/ui statuses,
   no `patch` status, no `flags:`/`paths:` — meaning its four named statuses
   (e.g. `web`) each measured the **whole merged report**, so a status named
   `web` gated every package at once, at a 15 pp looser floor than web actually
   enforces (40% target − 2% threshold = 38% pass line vs the proven 55%).
3. **`CONTRIBUTING.md`** — a third stale copy claiming "canonical source:
   `AGENTS.md`" while listing worker 55/50, schema 15/5, ui 10/5. Pre-existing
   Tier 1 issue; fixed in this change set.

Codecov constraints that shaped the design:

- Codecov statuses measure **line coverage only** — there is **no Codecov
  metric for functions coverage**. The `functions` floors in Tier 2 #4
  (`48%`, `60%`, `70%`, …) can therefore **never** be enforced by Codecov;
  vitest is the only possible enforcer. This ADR does not present Codecov as
  enforcing them, and neither may any future doc.
- `target` is the minimum ratio for success (`auto` = base commit, a number =
  absolute floor); `threshold` is the allowed drop, so the effective pass line
  is `target − threshold`.
- `base:` is deprecated since July 2020 — never reintroduce it.
- Two documented monorepo routes: `flags:` (requires split per-package
  uploads; "one report, many flags" is documented-incorrect) or `paths:` per
  status (works off the single merged report, **zero CI change**).

**Direction (fixed):** raise/complete `codecov.yml` to match the vitest
configs; never lower AGENTS.md or the vitest numbers — the vitest floors are
already enforced reality, and lowering would weaken a green gate while
codecov's loose numbers gate nothing.

## Decision

1. **`coverage-thresholds.json` (repo root) is the single source of truth.**
   Keys = the seven package names (`web`, `worker`, `shared`, `reader-core`,
   `schema`, `testkit`, `ui`); each value = exactly
   `{lines, functions, branches, statements}` — the values carried by the
   vitest configs at adoption, copied verbatim (documented `branches`/
   `statements` floors for the first time). Shape mirrors the existing
   `.performance-budgets.json` pattern: a machine-readable budget file at the
   repo root consumed by a gate script.
2. **Vitest is the enforcing layer** for absolute per-package floors on all
   four metrics, including **functions** (which Codecov structurally cannot
   gate). All seven `vitest.config.ts` files `import … from
'../../coverage-thresholds.json'` (static import — per AGENTS.md Tier 1
   never `readFileSync(new URL(…))`, which trips Codacy's
   `security/detect-non-literal-fs-filename`) and feed
   `coverage.thresholds`. **No value changed**: behavior is bit-identical to
   the pre-change configs.
3. **Codecov is the PR-facing regression/diff layer.** `codecov.yml` is
   rewritten with path-based per-package `project` statuses: `target:` =
   that package's `lines` floor from the JSON, `threshold: 2%`, `paths:` =
   the package directory, plus the three missing statuses (schema 90,
   testkit 25, ui 40) and `project.default: false` so no accidental
   whole-repo status appears.
4. **Reader-core: 72% now, 75% pending measurement.** Codecov previously
   demanded 75% while the proven floor is 72%; the status is aligned to 72%
   (a sanctioned loosening — the vitest floor, not the fossil, is the proven
   reality). Raising it to 75% requires a measured run first. **Not measured
   in this change** — a concurrent quality-gate run made any coverage
   execution unsafe (AGENTS.md Tier 2 #13); recorded as an open question.
5. **`paths:` chosen over `flags:`.** `paths:` computes each status from the
   single merged report already uploaded by `codecov-action@v7` — zero CI
   change. The `flags:` route requires split per-package uploads (the current
   one-shot upload is "one report, many flags", documented as technically
   incorrect) and a CI change this ADR does not need.
6. **Patch status (the diff-coverage ratchet): `target: 80%`,
   `threshold: 0%`, `informational: true`.** Explicitly _informational_, not
   blocking, because: (a) branch protection could not be read (HTTP 403, see
   Open questions) so we cannot confirm which contexts are required;
   (b) an 80% absolute diff floor has no track record in this repo and a
   ratchet must be observed before it gates — promotion is a one-line flip
   (`informational: true` → remove) **after** a follow-up ADR confirms the
   rate at which recent PRs would have failed _and_ the required-check list.
   The repo's stated posture (codecov upload `fail_ci_if_error: false`, "a
   Codecov outage must not red main") supports starting informational.
7. **`autoUpdate` ratchet: rejected.** Vitest's `coverage.thresholds.autoUpdate`
   rewrites threshold values from inside test runs; that (a) mutates gate
   configuration without human review, and (b) has no meaningful semantics now
   that configs hold _references_ into the SSOT JSON rather than literal
   numbers. Floors rise only via a reviewed PR touching
   `coverage-thresholds.json`.
8. **Docs hold pointers, never values.** AGENTS.md Tier 2 #4 and
   `CONTRIBUTING.md` now name `coverage-thresholds.json` and the parity
   script instead of restating numbers (root AGENTS.md line count decreased,
   180 → 177). A doc that contains no number cannot drift from one that does.
9. **`scripts/validate-coverage-parity.sh` enforces the chain** — deterministic,
   offline, no tests, no network. It fails when: the JSON shape deviates
   (≠7 packages × 4 integer metrics); any `vitest.config.ts` stops importing
   the JSON with the exact reference form or re-introduces a numeric literal;
   any `codecov.yml` target ≠ the JSON `lines` floor (or thresholds ≠ 2%,
   paths wrong, statuses missing/extra, `default` not disabled, patch policy
   ≠ 80%/0%/informational, or `base:` reappears); or the docs either lose the
   pointer or re-gain hand-typed numbers. It also checks its own wiring
   (`gate-manifest.json → local.checks` contains `coverage-parity` and
   `quality_gate.sh` invokes it). Wired as a gate phase (4-line call, logic in
   the script, modeled on the `check-loc` phase) and declared in
   `scripts/gate-manifest.json` → `local.checks`.

**Anti-drift chain:** `coverage-thresholds.json` → vitest (absolute enforcement,
all four metrics) → codecov.yml (PR-facing lines regression, path statuses) →
docs pointers (zero values) → `validate-coverage-parity.sh` (gate phase that
proves every arrow). Provenance of the fossil this closes: `plans/archive/022-adr-coverage-and-benchmarking.md`.

## Consequences

- One edit to `coverage-thresholds.json` changes what vitest enforces; the
  parity script forces codecov and docs to move in the same PR.
- PR authors see seven honest per-package Codecov statuses (path-scoped)
  instead of four whole-repo statuses under misleading names, plus a
  non-blocking patch signal.
- Contributors cannot copy a stale threshold from CONTRIBUTING.md or
  AGENTS.md anymore — the numbers exist in exactly one committed file.
- `quality_gate.sh` grows to 492 lines (still ≤500; already inside the
  ADR-278 450–500 warn zone, which only warns).

## Alternatives rejected

- **Lower AGENTS.md to match codecov.yml** — would weaken a currently-green
  vitest gate to satisfy a fossil.
- **`flags:` route** — needs split per-package uploads; wrong for the
  single merged-report CI we run today.
- **Presenting Codecov as the functions-floor enforcer** — impossible; there
  is no functions metric.
- **`autoUpdate: true`** — test runs must never rewrite gate config (see
  Decision 7).

## Open questions

- **Is any Codecov status a required check in branch protection?**
  `gh api repos/d-oit/do-epub-studio/branches/main/protection` → **HTTP 403
  "Resource not accessible by integration"**; GraphQL
  `repository.branchProtectionRules` → **FORBIDDEN** with the same message.
  Unresolved with this token. Risk if `codecov/project` _was_ required:
  `project.default: false` stops posting it, leaving a required check pending
  forever — confirm the required-context list (needs `administration:read`)
  before/at merge.
- **`paths:` vs real lcov `SF:` paths** — verify on the first PR after merge
  that each path status matches >0 files; fallback is a `fixes:` entry or the
  flags route.
- **Reader-core → 75%**: unresolved, no measurement taken (Tier 2 #13
  forbids running a suite while the concurrent gate runs); measure
  `pnpm --filter @do-epub-studio/reader-core test:coverage` in isolation
  first.
- **do-harness sensor** for `coverage-parity` (ADR-246 same-command parity
  with the gate phase) deferred as P2.
