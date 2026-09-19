# GOAP-271: Resolve the react 19.3.0 upgrade decision (#1143, #1144)

**Status:** DONE (decision: reject the bump — stay on react 19.2.8)
**Date:** 2026-09-19
**ADR:** ADR-250 (`plans/250-adr-dependency-bump-bundle-ratchet.md`)

## Context

- #1137 bumped react-dom to 19.3.0 while react stayed at 19.2.8 — an
  incompatible pair (react-dom 19.3.0 hard-errors at import) that broke all 13
  `packages/ui` component test files on any fresh install; CI stayed green only
  via the turbo test cache.
- #1142 reverted react-dom to 19.2.8 (merged 2026-09-15). Main is a consistent
  react 19.2.8 + react-dom 19.2.8 pair again; verified 2026-09-19 with
  `pnpm install --frozen-lockfile` + `pnpm --filter @do-epub-studio/ui test:unit`
  — 13/13 files, 147/147 tests pass.
- #1134 (Dependabot) proposes react + @types/react 19.3.0. Measured during the
  GOAP-264b sweep: ~11 KB gzipped per route (reader +4.14%, catalog +6.72%,
  admin +6.79% total), tripping the `Gzipped bundle budget (ADR-107 §3)` CI
  check on all three routes (PR #1134, run 35005816470).
- React 19.3.0 (2026-09-09) is a feature release — stable `<ViewTransition>`,
  Fragment Refs, `browser()` API, Trusted Types support — plus bug fixes, with
  no security fixes. This repo's page transitions already use the browser API
  directly (`document.startViewTransition` + `flushSync` in
  `apps/web/src/components/ViewTransitionRoutes.tsx`), so none of the new APIs
  are needed today.

## Decision

Issue option 2: reject the size increase. Keep react@19.2.8 + react-dom@19.2.8,
close #1134 (not planned), close #1143 and #1144. Policy recorded in ADR-250.
Re-propose react 19.3.x later as a single react + react-dom + @types/react
lockfile change when it meets the ADR-250 acceptance bar, with bundle-baseline
regeneration and an ADR-107 note in the same PR.

## Phases

| # | Phase | Exit criteria | Status |
|---|-------|---------------|--------|
| 1 | Verify interim state: consistent 19.2.8 pair passes fresh-install vitest | 13 packages/ui files pass without the test cache | DONE 2026-09-19 |
| 2 | Document decision as GOAP plan + ADR-250 | Plan + ADR merged to main | DONE (this PR) |
| 3 | Close #1134 (not planned) and #1143/#1144 with rationale + re-proposal criteria | All three closed, cross-linked | DONE |

## Related

- GOAP-264b (sweep that surfaced the facts)
- ADR-107 §3 (bundle budget enforced by the ratchet)
- #1137 / #1142 (version skew and its revert)
