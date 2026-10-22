# ADR-1011: Scope Madge cycle analysis to runtime code and real import boundaries

**Status:** Accepted
**Date:** 2026-10-22
**Deciders:** Project maintainer
**Related:** GOAP-1011 (`plans/1011-goap-madge-circular-graph-resolution.md`), PR #1377, ADR-083, `AGENTS.md` Tier 1 quality-gate policy

## Context

The dead-code gate ran Madge over TS/TSX sources without modeling the repository's Vite and Cloudflare module resolution. Madge printed 10 skipped-import warnings for:

- Vite's root `VERSION?raw` and generated `virtual:pwa-register` imports;
- the Vite `@/` source alias;
- CSS `@import` assets (font packages and Tailwind);
- the Cloudflare runtime module `cloudflare:workers`;
- the Storybook package used by stories.

The gate checked only circular-dependency counts, so unresolved imports were diagnostic-only. Treating them as harmless would violate the repository's fail-on-warning policy; excluding all warnings would weaken the check.

## Decision

1. **Resolve valid imports at the analyzer boundary.** `scripts/madge-circular-check.cjs` registers narrowly scoped resolvers on the exact `filing-cabinet` instance loaded by Madge's `dependency-tree`. It follows the existing Vite `@/` alias, strips `?raw` only when the referenced file exists, maps the PWA virtual import to the installed plugin runtime, maps the Cloudflare builtin to its generated declaration, and uses Node resolution for packages.
2. **Analyze runtime-code edges only.** TS/TSX source files seed the graph; TS/TSX and JavaScript dependencies may participate in cycles. CSS, `.d.ts`, and non-code assets are excluded as graph edges, and `.d.ts` files are not roots. They cannot create runtime module cycles.
3. **Unresolved imports remain blocking.** The checker reports Madge's skipped imports and exits non-zero. The shell gate retains its existing circular-dependency baseline and does not suppress warnings.
4. **The mappings are not runtime proof.** The static checker validates a source dependency graph only; runtime claims still require the relevant application smoke test.

## Alternatives rejected

- **Ignore Madge warnings or use broad excludes:** rejected; this would make a missing source import indistinguishable from a valid virtual/platform edge and weaken the sensor.
- **Map virtual imports to empty placeholder modules:** rejected; mappings must reference the actual installed PWA runtime or generated platform declaration.
- **Traverse CSS and generated declaration imports as runtime modules:** rejected; these are assets/type declarations, not executable module edges, and can create false cycles.

## Consequences

- Vite and platform-specific imports no longer create false skipped-module diagnostics.
- A new unresolved import is fail-closed in the dead-code gate.
- A Madge or `dependency-tree` upgrade must preserve resolver registration and is covered by the BATS behavior tests plus the full graph check.
- The cycle scan is explicitly limited to runtime source code; it is not a bundler or browser-runtime proof.
