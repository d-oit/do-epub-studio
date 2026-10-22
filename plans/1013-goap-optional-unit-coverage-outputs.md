# GOAP-1013: Optional coverage outputs on bare unit runs

**Status:** MONITOR — blocked by the approved task-contract boundary; no warning suppression.
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

Until that prerequisite is resolved, the diagnostics remain visible. This record does not permit failed tests, lint/build diagnostics, missing coverage evidence, or red/pending applicable CI checks to be ignored.
