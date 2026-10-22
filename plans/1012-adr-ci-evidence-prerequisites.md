# ADR-1012: CI evidence requires matched workloads and installed prerequisites

**Status:** Accepted
**Date:** 2026-10-22
**Related:** GOAP-1012 (`plans/1012-goap-pr1377-ci-evidence.md`), PR #1377, ADR-312

## Context

Correcting a benchmark fixture in PR #1377 caused CI to compare different workloads under the same name. Its base run returned before chapter loading, while the head run scanned the chapter. Separately, the quality-gate job emitted missing-do-harness warnings and skipped checks because the tool was installed only in the independent harness-contract job.

## Decision

- The baseline implementation runs the same corrected reader-core benchmark fixture as the head. The baseline implementation and locked dependency graph remain unchanged; no implementation source is copied from the head. The comparison threshold and combined-rme rule remain unchanged.
- The Full Quality Gate installs the same pinned, checksum-verified do-harness binary as the completion-contract job. A job cannot rely on another job's filesystem installation.
- Browser interaction failures remain blocking until diagnosed and exercised. A passing subset or a retry without cause analysis does not replace the failed consumer journey.

## Consequences

Benchmark evidence measures implementation differences rather than fixture changes. Compliance and DORA checks actually run in CI. The PR remains blocked by any unfinished or failed applicable check; local green checks and an incomplete status rollup do not authorize a merge.
