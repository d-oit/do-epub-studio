# GOAP-1433: Revisit evidence-backed unfixable dependency warnings

**Status:** In Progress
**Date:** 2026-11-17
**Decision:** [ADR-1433](1433-adr-unfixable-dependency-warnings.md)
**Related:** ADR-107, GOAP-276, ADR-083

## Goal

Keep the approved ESLint 10.15.0 / TypeScript 6.0.3 dependency targets while making the remaining install-time peer and deprecation warnings a tracked, actionable follow-up. Do not downgrade majors, inject peer overrides, or force dependency majors outside declared ranges purely to silence `pnpm`.

## Baseline evidence (2026-11-17)

A fresh `pnpm install --lockfile-only` after removing the unused deprecated Worker Vitest pool package and aligning Workbox emits:

1. Peer warnings — `eslint-plugin-import@2.32.0` advertises ESLint support only through 9; `eslint-plugin-jsx-a11y@6.10.2` through 9; `eslint-plugin-react@7.37.5` through 9.7. Latest published peer ranges for these plugins remain incompatible with ESLint 10.
2. Peer warning — `madge@8.0.0` advertises TypeScript `^5.4.4`, while the approved root TypeScript is 6.0.3.
3. Deprecated transitive — `glob@11.1.0` (newest 11.x, deprecated as an old unsupported/vulnerable major) is pulled by the current `workbox-build@7.4.1` (`glob: ^11.0.1`); forcing glob 13/14 would violate Workbox's declared range.

## Why not silence or force

- Downgrading ESLint/TypeScript majors contradicts the approved targets and undoes the alignment work already merged.
- Hiding the warnings with pnpm peer overrides masks genuine unsupported combinations and can desync the installed graph from declared ranges.
- Forcing glob 13/14 outside `workbox-build`'s declared range risks runtime incompatibility in the service-worker build path; that behavior change is not free.

## Acceptance (observable closure criteria)

This follow-up closes only when all of the following hold:

- [ ] `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, and `eslint-plugin-react` publish peer ranges covering ESLint 10, and a clean `pnpm install` reports no peer warning for them.
- [ ] `madge` publishes a version whose TypeScript peer range covers 6.0.3 (or the repo adopts an equivalent maintained graph checker within the approved stack), and no TypeScript peer warning remains.
- [ ] `workbox-build` declares a glob major compatible with a maintained release (or otherwise stops pulling the deprecated `glob@11`), and no deprecation warning remains.
- [ ] A clean `pnpm install --lockfile-only` from the current lockfile state prints zero dependency-related warnings.

Until then the warnings are accepted, visible, and not hidden by overrides or downgrades. Revisit after each upstream release; the tracking decision is ADR-1433.

## Revisits

- **2026-11-18** — Rechecked upstream: `eslint-plugin-import@7.37.5`, `eslint-plugin-react@7.37.5`, and `eslint-plugin-jsx-a11y@6.10.2` still advertise ESLint 9 peers; `madge@8.0.0` still pins `typescript ^5.4.4`. A fresh `pnpm install --lockfile-only` with the removed unused vitest pool package leaves exactly the accepted peer/deprecation set, so the install-time warnings stay visible and accepted until new upstream releases change the peer math.
