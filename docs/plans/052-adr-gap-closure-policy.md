# ADR-052: Product, CI, Release, and Documentation Drift Closure

**Status:** ✅ Accepted — Policy validated by PR #358 execution
**Date:** 2026-05-26
**Related:** `docs/plans/052-goap-codebase-gap-analysis.md`, ADR-034, ADR-035

## Context

The repository has strong guardrails, but the current state shows drift across
four surfaces:

- Product runtime workflows are documented as available while admin book/grant
  flows have API contract mismatches.
- CI gates are present but currently fail on security alerts, dependency audit,
  pre-commit formatting, workflow validation tooling, and Scorecard publishing.
- Release metadata is split between `VERSION`, workspace `package.json` files,
  changelog content, and GitHub Release assets.
- README, SECURITY, AGENTS, and scripts docs contain stale or contradictory
  statements.

Treating these independently causes repeated partial fixes. The project needs a
single closure policy for drift between implemented behavior and declared
behavior.

## Decision

1. Runtime contract gaps take priority over presentation/docs cleanup.
   Admin UI requests and Worker schemas must be fixed together, with tests at
   both route and UI-helper boundaries.

2. Security gates are blocking.
   Open CodeQL alerts and high dependency audit findings must be fixed or
   privately triaged through `SECURITY.md`; they must not be converted into
   public backlog issues first.

3. Workflow validation must be hermetic.
   Validation scripts may download pinned tools into repo-local or user-local
   writable paths, but must not depend on system Python package installs or
   read-only global Node shims.

4. Release version metadata has one policy.
   `VERSION`, root package version, workspace package versions, changelog
   release section, Git tag, and GitHub Release assets must be reconciled by the
   `release-management` skill before the next release.

5. Documentation must be evidence-backed.
   README and security docs can describe only implemented behavior unless a
   clearly labeled roadmap section points to an active GOAP plan.

6. AGENTS.md remains concise.
   Keep it under `MAX_LINES_AGENTS_MD`, fix malformed markdown/numbering, and
   move expanded workflow explanations to `agents-docs/`.

## Consequences

### Positive

- Product claims, code paths, and tests converge.
- CI failures become actionable instead of noisy.
- Release consumers can trust version and artifact metadata.
- Agent workflow rules remain small enough to read fully.

### Negative

- Fixes may require several small PRs rather than one docs-only cleanup.
- Some release/documentation cleanup must wait until runtime and CI blockers are
  resolved.

## Implementation Policy

Each drift cluster gets a GOAP entry with:

- concrete evidence from code or CI,
- owner surface (`apps/web`, `apps/worker`, `scripts`, `.github`, docs),
- validation command,
- docs update required after code changes.

Do not edit `KNOWN-ISSUES.md` directly. Mirror monitor-tier items only after a
GOAP plan and ADR define the policy.

## Validation

The policy is satisfied when:

- admin book/grant workflows work with authenticated API calls,
- CodeQL and dependency audit gates pass,
- workflow validation runs without skipped `actionlint` or `zizmor`,
- release metadata and assets match the published tag,
- README, SECURITY, AGENTS, and scripts docs no longer contradict the code.
