# ADR-1021: Track Existing LOC Warn-Zone Files as Active Extractions

**Date:** 2026-11-05
**Status:** Accepted
**Deciders:** Project maintainer
**Issue:** #1466
**Related:** ADR-278, GOAP-276, GOAP-1021

## Context

The quality gate for the EPUB authoring change surfaced five pre-existing source files in the 450–500-line warn zone. ADR-278 defines this zone as extract-now debt, and `AGENTS.md` requires gate warnings to be addressed rather than silently ignored. Refactoring these unrelated modules inside the authoring change would widen risk and obscure the feature review.

## Decision

1. Track the five files and their observed line counts in active plan GOAP-1021 and issue #1466.
2. Reduce each file below 450 lines by extracting cohesive responsibilities while preserving its behavior and consumers.
3. Do not suppress the warning, change the LOC threshold, or increase `scripts/loc-baseline.json`.
4. Link the active follow-up from the authoring PR description so the existing debt is explicit and actionable.

## Consequences

- The warning-zone debt has named files, acceptance criteria, and an owner-visible tracking issue.
- Each extraction is independently testable and can be reviewed without mixing it into authoring behavior changes.
- The source-size policy remains unchanged; all five files leave the warning zone when GOAP-1021 closes.

## References

- [ADR-278: The 500-line source cap ships as a shrink-only ratchet](278-adr-loc-ratchet-policy.md)
- [GOAP-1021: LOC warning-zone extractions](1021-goap-loc-warning-zone-extractions.md)
- [Issue #1466](https://github.com/d-oit/do-epub-studio/issues/1466)
