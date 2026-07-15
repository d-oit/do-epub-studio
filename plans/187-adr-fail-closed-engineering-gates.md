# ADR-187: Fail-Closed Engineering and Release Gates

**Status:** Proposed  
**Date:** 2026-07-14  
**Driven by:** Plan 186 repository implementation, workflow, and CI audit

## Context

The repository has extensive quality and security policy, but several executable paths currently interpret missing evidence as success:

- the full quality gate can skip required phases and still exit zero;
- workflow validation can continue without required validators;
- atomic PR verification accepts zero registered checks;
- Lighthouse can skip on deployment failure and downgrade failed assertions;
- CodeQL API errors can be reported as zero alerts;
- release tags do not prove that the exact SHA passed all readiness gates;
- an unknown action SHA can be copied from workflow input into its own trust allowlist;
- atomic rollback can force-push `HEAD~1` without protecting concurrent remote updates.

These are not independent style issues. They share one architectural defect: absence, unavailability, or ambiguity of validation evidence is treated as equivalent to a successful result.

## Decision

All mandatory engineering, security, PR, and release gates will use a fail-closed result model. A required gate has exactly four observable states:

1. **Passed** — the named check executed against the expected commit and met its policy.
2. **Failed** — the check executed and violated policy.
3. **Unavailable** — tooling, credentials, service, target, or output was unavailable.
4. **Not applicable** — a version-controlled rule explicitly excludes the change.

Only **Passed** and an explicitly justified **Not applicable** state may satisfy readiness. **Unavailable**, missing, skipped, timed out, malformed, or unregistered evidence must not be coerced to Passed.

## Required Controls

### 1. Validation identity and completeness

- Every required check has a stable ID, owner, execution context, and expected artifact or result.
- PR verification compares observed checks with an explicit required-check set for the exact head SHA.
- Local, PR, and release entry points consume a shared machine-readable gate manifest or have parity tests proving intentional differences.
- Skip controls belong only to clearly named development commands; the canonical full gate returns non-success when a required check is skipped.

### 2. Tool and service availability

- Required validators use pinned versions and integrity-checked installation.
- Missing actionlint, zizmor, YAML validation, reports, or audit targets fails blocking validation.
- API errors are represented as Unavailable or Failed, never as an empty result set.

### 3. Supply-chain trust

- SHA pinning establishes immutability, not trust.
- An action SHA becomes trusted only through reviewed provenance linking the action repository, intended release/tag, and resolved commit.
- CI never modifies its own action trust allowlist from untrusted workflow content.
- Validation jobs are read-only unless mutation is the job's explicit, separately reviewed purpose.

### 4. Shared-history safety

- Automated rollback records exact local and remote preconditions.
- Remote rollback uses a lease tied to the SHA produced by the automation.
- If remote state changed concurrently, automation stops and preserves the branch for manual recovery.
- Failure to create or verify a PR does not justify deleting unrelated remote history.

### 5. Release provenance

- Production work starts only after proving that the tag matches repository version metadata and its SHA is reachable from the protected main branch.
- Coverage, Codacy, required PR checks, scheduled cross-browser E2E, performance budgets, and security checks are bound to that exact SHA or rerun in the trusted release workflow.
- Missing historical evidence blocks release; it does not become an implicit pass.

## Alternatives Considered

### Keep advisory behavior for developer velocity

Rejected for mandatory gates. Advisory tools may remain, but their names and outputs must not imply readiness and they cannot satisfy required policy.

### Retry unavailable checks and then continue

Rejected as a final outcome. Bounded retries are appropriate for transient failures, but exhaustion results in Unavailable and blocks readiness.

### Trust every immutable action SHA

Rejected. A malicious commit is still immutable. Provenance review is required in addition to SHA pinning.

### Automatically delete failed PR branches

Rejected. Preserving an isolated failed branch is safer than force-pushing shared history based on local ancestry assumptions.

## Consequences

### Positive

- A green gate means required evidence actually exists for the expected commit.
- Service outages and permission problems cannot masquerade as zero findings.
- Release provenance becomes auditable and reproducible.
- Supply-chain and rollback controls protect against self-authorization and concurrent-update loss.
- Local, PR, and release workflows have a testable shared contract.

### Negative

- CI outages and missing credentials may block merges or releases.
- Initial rollout may expose latent failures and increase setup work.
- Route-specific Lighthouse and cross-browser evidence require deterministic fixtures and additional runtime.

### Mitigations

- Use bounded retries, cached pinned tools, and deterministic local fallbacks where they preserve equivalent coverage.
- Separate advisory checks from required checks in names, manifests, and branch protection.
- Roll out in the dependency order defined by Plan 186, beginning with history and trust safety.
- Optimize runtime only after parity and correctness are proven.

## Compliance and Verification

Plan 186 must add negative tests for each failure mode: skipped tool, missing validator, zero CI checks, unknown SHA, concurrent remote update, failed Lighthouse target/assertion, CodeQL API error, invalid or unmerged release tag, and missing release evidence.

This ADR is satisfied when those tests fail closed, the positive paths pass, and branch protection/release environment rules require the resulting checks without administrator bypass.

## References

- Plan 186 — Codebase, Workflow, and CI Remediation
- Plan/ADR 129 — CI release readiness
- Plans 180/992 — Missing implementation remediation
- Plans 182/994 — GitHub Issues, Pull Requests, and CI remediation
- Plans 184/996 — Agent workflow and harness audit
- AGENTS.md Tier 1 and Tier 2 requirements
