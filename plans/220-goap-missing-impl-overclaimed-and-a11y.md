# GOAP 220: Implement Overclaimed Plan 219 Items + Fix accent-error Contrast (CI #928)

**Date:** 2026-08-08
**Status:** In Progress
**Goal:** Close the genuinely-missing implementation gaps that plans 219/216/217/218
declared complete (`[x]`) but the verification swarm proved are not on `main`, and
fix the `accent-error` color-contrast defect that caused scheduled CI E2E failure
issue 928. All CI must pass.
**Related:** Plan 212, Plan 216, Plan 217, Plan 218, Plan 219, ADR-212, ADR-063a

## 1. Analysis (verification swarm, main @ 4db1f70)

A read-only swarm (two parallel Explore agents) audited the plans/ folder against
the tree. Findings:

| ID | Plan claim | Real state on main | Action this PR |
|----|-----------|--------------------|----------------|
| P1 | 219 T3.1 annotation virtualization `[x]` | PARTIAL — `annotation-adapter.ts` already has rAF `scheduleRender`/`cancelScheduledRender`, but `useReaderEpub.ts` calls `renderHighlights`/`renderCommentMarkers` **directly** on every `relocated` event (lines 315-320, 327-328, 352-353); no debounce of the relocated handler | Wire the hook through `scheduleRender` (rAF batched) + debounce relocated annotation painting |
| P2 | 219 T3.3 search virtualization `[x]` | DONE — `SearchPanel.tsx` viewport-windows results via `visibleRange`/`handleScroll` and only renders the visible slice | None (verified complete; document) |
| P3 | CI #928 `accent-error` contrast | REAL — `--color-accent-error: oklch(65% 0.2 25)` as `text-accent-error` on `bg-accent-error/10` (#feeded) = **3.14:1**, fails WCAG AA 4.5:1 axe (`color-contrast`, serious). Used in ~10 components | Darken `--color-accent-error` token (and P3/dark variants) so tint-text passes; improves `bg-accent-error text-white` danger button too |

Out of scope (confirmed deferred backlog, not overclaimed): F1/T15 reading-insight
chapter semantics, F3/T16 admin aggregation, N6 skeletons/shortcuts.

## 2. Decomposition — Parallel Swarm

| Task | Scope | Key files |
|------|-------|-----------|
| T1 | P1: route annotation rendering through rAF-batched `scheduleRender` + debounce relocated handler | `apps/web/src/features/reader/hooks/useReaderEpub.ts`, `packages/reader-core/src/annotation-adapter.ts`, tests |
| T2 | P3: darken `--color-accent-error` (root/P3/dark) so `text-accent-error` on `bg-accent-error/10` passes 4.5:1 | `apps/web/src/styles/globals.css`, a11y E2E specs confirm |

## 3. Execution Strategy

Hybrid swarm per ADR-212: Wave 1 = T1 + T2 in **parallel** (disjoint file sets —
hook/adapter vs globals.css). Orchestrator commits each logical change separately.

Quality gates:
1. After Wave 1: `pnpm lint` + `pnpm typecheck` for touched packages, targeted unit tests.
2. Final: `./scripts/quality_gate.sh` before push.
3. CI green on PR; E2E a11y specs pass for accent-error.

## 4. Acceptance Criteria

- [x] Annotation painting batches in a single rAF per relocated event; no layout
      thrash on rapid chapter navigation; `cancelScheduledRender` on unmount
- [x] Existing annotation tests pass; new/adjusted test covers batching
- [x] `text-accent-error` on `bg-accent-error/10` passes axe `color-contrast` (≥4.5:1)
- [x] Danger button `bg-accent-error text-white` contrast preserved/improved
- [x] `./scripts/quality_gate.sh` passes before push
- [x] One feature-branch PR, atomic commits, PR template + AI verification section
- [ ] All CI checks pass; any PR feedback addressed and re-pushed
- [x] Plan statuses (219 T3.3 = done, T3.1 = now done) recorded accurately
