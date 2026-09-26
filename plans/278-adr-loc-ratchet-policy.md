# ADR-278: The 500-line source cap ships as a shrink-only ratchet

**Date:** 2026-09-24
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-276 (P0 #4), AGENTS.md Tier 3, ADR-083, ADR-246

## Context

AGENTS.md declares `MAX_LINES_PER_SOURCE_FILE=500`, but nothing enforced
it: no `quality_gate.sh` phase, no ESLint rule, no do-harness sensor
(GOAP-276 P0 #4). A live `git ls-files` scan found seven tracked source
files at 502–942 lines — `creator.ts` (942), `sanitizer.ts` (931),
`ReaderPage.tsx` (551), `ReaderToolbar.tsx` (519),
`transformers-editorial-format.ts` (513), `admin-middleware.ts` (507),
`transformers-editorial.ts` (502) — plus four files already in the
450–500 danger zone.

Enforcement cannot simply fail on `>500`: main would be red on day one,
and the seven offenders are large surface areas whose extraction is a
sequence of its own PRs. Declaring a cap nobody checks is the failure
mode this ADR closes.

## Decision

1. **`scripts/check-loc.mjs` runs as a quality-gate phase** and as the
   do-harness sensor `loc` (identical command — ADR-246 same-command
   parity), so local evidence and CI cannot drift. It is declared in
   `do-harness.toml` and in `gate-manifest.json` → `local.checks`.
2. **Scope:** tracked `.ts/.tsx/.js/.jsx/.mjs/.cjs/.py/.sh` files, minus
   `*.d.ts`, `apps/web/src/i18n/**` (locale tables), tests
   (`__tests__/`, `tests/`, `*.test.*`, `*.spec.*`), and `.agents/**`
   (skills are documents, not sources).
3. **Ratchet baseline `scripts/loc-baseline.json`** records the exact
   current line count of each grandfathered offender. The check fails on:
   - an in-scope file over 500 with no entry (new violation),
   - a baselined file whose count differs from its entry — growth past
     the ratchet, or a stale entry that must be tightened (and deleted if
     the file dropped to ≤500),
   - a baseline entry whose file is gone or out of scope.
     Baselines only ever shrink; there is no "raise the baseline" path.
4. **450–500 warns** without failing — the extract-now zone, matching
   GOAP-276's 450 warn threshold.

## Consequences

- Main stays green while the cap is real for everything new: no PR can
  add or grow a file past its recorded count.
- The baseline doubles as a visible debt list
  (`jq 'keys' scripts/loc-baseline.json`); extracting an offender means
  deleting its entry in the same PR, which the stale-entry rule enforces.
- The gate itself is a live demo of the warn zone
  (`scripts/quality_gate.sh`, 487 lines at adoption) — the cap grows
  tight as phases are extracted rather than by raising the limit.

## Alternatives rejected

- **Enforce `>500` outright** — fails main immediately; the seven files
  need extraction PRs first.
- **ESLint `max-lines`** — no per-file ratchet (every rule change is a
  config debate, not a per-file debt record), and it would re-implement
  the same scope rules with less actionable output.
- **`do-harness loc` native cap enforcement** — tracked as P2 in
  GOAP-276; the baseline JSON remains the durable artifact, so adopting
  the native command later is a sensor swap, not a migration.
