# GOAP-1011: Model repository imports in Madge's circular-dependency graph

**Status:** DONE — targeted behavior tests, local full quality gate, and CI Full Quality Gate passed.
**Owner:** PR #1377 repair
**Related:** ADR-1011 (`plans/1011-adr-madge-runtime-graph.md`), `scripts/dead-code-check.sh`

## Problem

The full quality gate reported 10 Madge skipped-import warnings while its circular check still returned success. The imports are valid repository edges that the default resolver does not model: Vite's `?raw` and `virtual:pwa-register`, the `@/` Vite alias, CSS asset imports, Cloudflare's `cloudflare:workers` module, and Storybook's package entry. `AGENTS.md` requires every gate diagnostic to be fixed; hiding the warning or weakening the cycle scan is not acceptable.

## Goal

Keep cycle detection over runtime code, resolve the repository's valid bundler/platform imports accurately, and make any future unresolved import fail the dead-code gate.

## Plan

1. **Model the actual import boundaries.** Register narrow resolvers on the same `filing-cabinet` instance used by Madge's dependency tree: map `@/` to the Vite alias, `?raw` to its existing source file, the PWA virtual module to the installed plugin's runtime module, and `cloudflare:workers` to the generated worker declaration. Use Node resolution for package imports.
2. **Keep the cycle graph on code.** Seed it with repository TS/TSX sources and follow TS/TSX plus JavaScript code dependencies. Do not treat CSS, declaration files, or static assets as runtime-code edges. A declaration file is not a graph root.
3. **Fail closed.** Make the checker return non-zero and print each skipped import if Madge cannot resolve one; preserve the existing circular-dependency baseline comparison.
4. **Prove the behavior.** BATS covers cycle reporting, unresolved-import failure, Vite alias/raw-asset resolution, and Vite/Cloudflare platform edges. Run the repository dead-code check and the full quality gate.

## Acceptance

- No skipped imports from the repository graph.
- An unresolved import fails `scripts/dead-code-check.sh`.
- Runtime-code cycles remain reported and compared with the existing baseline.
- The full quality gate passes without Madge warnings.

## Evidence

- `bats scripts/tests/madge-circular-check.bats` — 4/4 passed.
- `./scripts/dead-code-check.sh` — passed; 712 code files processed, no skipped imports or cycles.
- Full quality gate with the new checker: passed locally and in CI run `39761528260` (`Full Quality Gate`).

## Completion

Implementation, 4/4 targeted proofs, and the full quality gate are complete in PR #1377.
