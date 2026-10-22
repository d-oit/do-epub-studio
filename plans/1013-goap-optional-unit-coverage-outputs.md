# GOAP-1013: Optional coverage outputs on bare unit runs

**Status:** RESOLVED (PR #1383) — cutover landed with cold/cached coverage proof; no warning suppression was used.
**Owner:** Build-tooling maintainer
**Related:** ADR-1013 (`plans/1013-adr-unit-coverage-artifact-contract.md`), PR #1370, tracking issue [#1382](https://github.com/d-oit/do-epub-studio/issues/1382)

## Evidence

The forced PR #1370 unit run used installed Turbo 2.11.9, executed 8/8 nodes uncached successfully, and emitted seven missing-output diagnostics for `coverage/**`. The summary's eight start/end intervals do not overlap. Bare unit execution does not request coverage; the existing root coverage script requests it through the same `test:unit` task.

## Blocker

The approved repair requires the exact root unit/coverage commands and preservation of the task graph and coverage floors. The shared output declaration serves the flagged coverage run. Removing that declaration would lose cached reports; always collecting coverage would alter bare-unit semantics. Neither is an acceptable warning fix in this change.

## Resolution path

1. Review a separate unit/coverage task-contract cutover, or verified upstream support for conditional outputs, with the build-tooling maintainer.
2. Prove both cold and cached coverage runs produce and restore all reports used by CI, while bare units preserve their current behavior.
3. Only then eliminate the optional-output diagnostics, preserving coverage floors and task scope. Close this monitor record with that evidence.

Until that prerequisite was resolved, the diagnostics remained visible. This record does not permit failed tests, lint/build diagnostics, missing coverage evidence, or red/pending applicable CI checks to be ignored.

## Resolution (PR #1383)

The cutover splits the two commands instead of muting the diagnostic: `test:unit` no longer declares `coverage/**`, while the existing dedicated `test:coverage` task keeps `outputs: ["coverage/**"]` with the same `inputs`, empty `dependsOn` and `env: ["NODE_OPTIONS"]`, plus an `@do-epub-studio/e2e#test:coverage` override (`outputs: []`) for the suite that produces none. The root script becomes `turbo run test:coverage --concurrency=1`, so the script name, serialization and every consumer (`scripts/quality_gate.sh`, CI `Run tests with coverage`, `scripts/gate-manifest.json`, `llms.txt`, and the unchanged `pnpm test:unit` harness sensor) are untouched. All eight workspace packages define `test:coverage`: `apps/worker` already did, and the other seven gained a script mirroring their own `test:unit` invocation (web's `NODE_OPTIONS=--max-old-space-size=4096`, reader-core's fixture generation, testkit/ui's `--passWithNoTests`).

Measured at the PR head with the `coverage/` directories deleted before each run (Turbo 2.11.x):

| Run                | Command                                    | Result                                                                                                                     |
| ------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Cold coverage      | `pnpm test:coverage --force`               | exit 0, 0 diagnostics, all 7 coverage-producing packages emitted `coverage-final.json`, `lcov.info`, `clover.xml` and HTML |
| Cached coverage    | reports deleted, then `pnpm test:coverage` | exit 0, 7 cache hits, 0 diagnostics, 7/7 report sets replayed back into place                                              |
| Bare unit (after)  | `pnpm test:unit --force`                   | exit 0, 8/8 tasks, 0 diagnostics, no `coverage/` directory created, all suites still ran                                   |
| Bare unit (before) | same command on main's task graph          | exit 0, 8/8 tasks, 7 missing-output diagnostics, no coverage produced                                                      |

`scripts/validate-coverage-parity.sh` (ADR-282 floors) and `scripts/validate-gate-parity.sh` pass at the same head. Coverage floors, task scope, serialization and sensors are unchanged, so this record closes without weakening a gate.
