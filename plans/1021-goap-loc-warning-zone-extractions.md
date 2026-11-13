# GOAP-1021: Extract Existing Source Files from the LOC Warning Zone

**Status:** IN PROGRESS (active follow-up)
**Date:** 2026-11-05
**Issue:** #1466
**Decision:** [ADR-1021](1021-adr-loc-warning-zone-extractions.md)
**Related:** [ADR-278](278-adr-loc-ratchet-policy.md), GOAP-276

## Goal

Reduce each of the five existing 450–500-line source files surfaced by the authoring PR's quality gate to fewer than 450 lines through cohesive extractions, preserving public behavior and contracts.

## Baseline

| Source file                                                         | Quality-gate count |
| ------------------------------------------------------------------- | -----------------: |
| `apps/epubcheck-runner/src/server.ts`                               |                484 |
| `apps/web/src/features/reader/ReaderPage.tsx`                       |                473 |
| `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx` |                476 |
| `apps/worker/src/lib/epub-annotation-export.ts`                     |                494 |
| `packages/reader-core/src/packager/annotation-export.ts`            |                469 |

## Execution slices

1. Extract cohesive server workflow helpers from `apps/epubcheck-runner/src/server.ts`.
2. Separate reader page responsibilities from `ReaderPage.tsx` and toolbar responsibilities from `ReaderToolbar.tsx`.
3. Separate worker annotation-export orchestration and packager annotation serialization into focused modules.
4. Run owning package tests for each slice, then validate the complete workspace.

The five source files are independent extraction slices; each must retain existing caller behavior and tests. Do not raise or add entries to `scripts/loc-baseline.json` to hide warn-zone counts.

## Acceptance

- All five listed files are below 450 lines.
- `node scripts/check-loc.mjs` reports no warnings for these paths and no violations.
- Existing behavior tests remain meaningful and pass; no test is weakened or removed to make the extraction pass.
- `pnpm verify` and `pnpm format:check` pass.
- The current PR description links issue #1466 and this active plan/ADR.
