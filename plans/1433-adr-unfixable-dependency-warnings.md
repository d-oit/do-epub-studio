# ADR-1433: Track unfixable dependency peer/deprecation warnings as open risk

**Date:** 2026-11-17
**Status:** Accepted
**Deciders:** Project maintainer
**Related:** GOAP-1433, ADR-083, ADR-107

## Context

The approved dependency targets for this repository are ESLint 10.15.0 and TypeScript 6.0.3. A fresh `pnpm install --lockfile-only` still emits install-time warnings that cannot be resolved without violating those targets or the declared ranges of other packages:

- Peer warnings: `eslint-plugin-import@2.32.0` advertises ESLint support only through 9; `eslint-plugin-jsx-a11y@6.10.2` through 9; `eslint-plugin-react@7.37.5` through 9.7. Latest published peer ranges for these plugins remain incompatible with ESLint 10.
- Peer warning: `madge@8.0.0` advertises TypeScript `^5.4.4`, while the approved root TypeScript is 6.0.3.
- Deprecated transitive: `glob@11.1.0` (newest 11.x, deprecated as an old unsupported/vulnerable major) is pulled by the current `workbox-build@7.4.1` (`glob: ^11.0.1`). Forcing glob 13/14 would violate Workbox's declared range.

## Decision

1. Keep the approved ESLint 10.15.0 / TypeScript 6.0.3 targets and all existing declared ranges.
2. Do not downgrade majors, inject pnpm peer overrides, or force dependency majors outside declared ranges to silence the warnings.
3. Track the warnings as open, actionable risk in GOAP-1433 with observable closure criteria. The warnings are not fixed and must not be claimed as fixed.

## Consequences

- Install logs remain truthful: unsupported peer combinations and the deprecated transitive stay visible until upstream catches up.
- Closure is driven by upstream releases (peer ranges that cover the approved targets, a maintained glob major inside Workbox's declared range), not by configuration tricks.
- The follow-up is one record away: GOAP-1433 names the exact packages, limits, and closure criteria.
