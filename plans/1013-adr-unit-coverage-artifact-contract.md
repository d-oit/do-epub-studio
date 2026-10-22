# ADR-1013: Preserve coverage cache artifacts while serializing unit tasks

**Status:** Accepted (scheduling fix PR #1370; task-contract cutover PR #1383)
**Date:** 2026-10-22
**Related:** GOAP-1013 (`plans/1013-goap-optional-unit-coverage-outputs.md`), PR #1370, PR #1383

## Context

PR #1370's forced serialized unit run executed all eight task nodes uncached, with exit code 0 and non-overlapping task intervals. Turbo 2.11.9 printed seven `no output files found` diagnostics because the shared `test:unit` task declares `coverage/**` but a bare unit run does not enable coverage.

The approved repair explicitly preserves the root coverage command's `test:unit -- --coverage` passthrough, task definitions and coverage floors. Turbo's installed configuration reference says empty outputs cache no files except logs; removing `coverage/**` would therefore make a cached coverage run omit its required report artifacts. Generating coverage on every bare unit run would also change the approved command contract.

## Decision

- Keep these diagnostics visible and classify them as optional-artifact metadata warnings, not failed tests, an absent coverage run, or evidence of worker termination.
- Do not remove coverage outputs, fabricate files, suppress warning output, change task caching, or weaken coverage thresholds to make a bare run quiet.
- Defer elimination of the warning until a separately approved unit/coverage task-contract cutover or upstream conditional-output support can preserve report caching. This is outside the explicitly constrained scheduling repair; GOAP-1013 records the review and acceptance boundary.
- That cutover landed as PR #1383: `test:unit` declares no outputs, a dedicated `test:coverage` task keeps `outputs: ["coverage/**"]`, and cold plus cached coverage runs and a bare unit run were measured before and after (7 diagnostics before, 0 after). See GOAP-1013 `## Resolution`. No coverage floor, task scope or sensor changed.
- The current PR still requires real serialized unit execution, real coverage verification, the full quality gate, final-head harness freshness, and all applicable CI checks. These warnings do not substitute for any of those proofs.

## Consequences

The no-concurrent-workspace policy is enforced without losing cached coverage artifacts. Since PR #1383 a bare unit run declares and produces no coverage, so it no longer prints optional-output metadata diagnostics (measured: 7 before, 0 after), while the dedicated coverage task still caches and restores every report. No runtime test, cache report declaration, coverage floor or sensor is removed.
