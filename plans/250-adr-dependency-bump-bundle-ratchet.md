# ADR-250: Dependency Bumps vs the ADR-107 §3 Bundle Ratchet

**Date:** 2026-09-19
**Status:** Accepted
**Deciders:** Project maintainer (option 2 of #1144, executed via GOAP-271)
**Related:** ADR-107 §3, GOAP-271, docs/performance-budgets.md

## Context

React 19.3.0 (#1134) adds ~11 KB gzipped per route (reader +4.14%, catalog
+6.72%, admin +6.79% total) and trips the `Gzipped bundle budget (ADR-107 §3)`
CI check on all three routes. It is a feature release — stable
`<ViewTransition>`, Fragment Refs, `browser()` API, Trusted Types support —
with no security fixes; the codebase's page transitions already use the
browser API directly. The same episode exposed a second hazard: #1137 bumped
react-dom alone to 19.3.0, a pair skew that hard-errors every fresh-install
vitest run while CI stays green via the test cache (reverted in #1142).

## Decision

1. Version-update bumps (Dependabot or manual) that trip the ADR-107 §3
   ratchet are rejected by default. Acceptance requires a concrete, stated
   trade-off — a security fix, a fix for a bug this codebase actually hits, or
   a feature the codebase adopts in the same PR — not freshness alone.
2. React stays at 19.2.8 with react-dom 19.2.8. Re-propose react 19.3.x as a
   single react + react-dom + @types/react lockfile change when the bar in (1)
   is met, including bundle-baseline regeneration
   (`scripts/generate-bundle-baseline.sh`) and an ADR-107 note in the same PR.
3. Runtime pairs move together: react and react-dom must change in one
   lockfile change. Single-package bumps of a versioned runtime pair are
   rejected even when individually green — the skew only manifests on fresh
   installs, where no test cache masks it.

## Consequences

- Per-route bundle budgets stay flat without an explicit, reviewable
  trade-off.
- Fresh-install correctness, not cached CI, is the acceptance bar for runtime
  bumps.
- React feature upgrades are deferred until they pay for their bytes; the
  ratchet does the forcing.
