# ADR-216: Vitest Pool Policy and Mobile Test Isolation

> **Status:** Accepted
> **Supersedes:** none
> **Related:** `plans/archive/216-goap-execute-plan215-non-gated-waves.md`, ADR-021, ADR-067
> **Deciders:** maintainers
> **Tags:** testing, ci, vitest

## Context

Plan 216's task W2-A resolved the Vitest worker-pool policy. Prior to this
decision the `web` package ran tests under the default `threads` pool, which
suffered cross-file environment bleed (shared jsdom globals leaking between
suites) and made deterministic reset unreliable, especially around
service-worker and IndexedDB mocks. This gave rise to flaky tests under
parallel execution.

Per AGENTS.md TIER-3, the project requires Vitest + Playwright to use
`pool: 'forks'` for test isolation.

## Decision

1. **The `web` package runs unit tests with `pool: 'forks'`.** Each test file
   runs in its own forked worker process, isolating module state, globals, and
   environment mocks. This is the authoritative Vitest config for the `web`
   package.
2. **`poolOptions` are spelled at the top level where the installed Vitest
   version supports it** (Vitest 4 migrated `poolOptions` to top-level options);
   the config must not emit the deprecated `test.poolOptions` nesting. See
   `apps/web/vitest.config.ts`.
3. **Isolation is the default; reset is explicit.** Suites that mutate module
   state (in-memory sync/conflict maps, IndexedDB, `navigator.storage`) call the
   relevant reset helpers (`clearAllConflicts`, `clearResolvedConflicts`,
   IndexedDB deletion) in `beforeEach` rather than relying on worker reuse.
4. **The CI PR smoke job includes a mobile viewport project** (e.g. `pixel`)
   so layout and touch-target regressions surface before merge, not only in the
   nightly full suite.

## Consequences

### Positive

- Deterministic test isolation; JS globals and module-level maps no longer
  leak across files.
- Flake reduction under parallel CI execution.
- Mobile smoke coverage in the PR gate per ADR-201 philosophy (WebKit +
  mobile).

### Negative

- Slightly higher CI wall-clock from process-per-file overhead.
- Fork cost is highest for component suites; mitigated by targeted `test:unit`
  path selection when iterating locally.

### Neutral

- No change to production code; this is a test-infrastructure policy.

## Compliance

- AGENTS.md TIER-2 rule 4 (coverage thresholds) is evaluated under this pool.
- Future config edits must preserve `pool: 'forks'` and top-level
  `poolOptions` formatting; a downward move to `threads` requires this ADR's
  revision.
