# GOAP-283: Make `gate-manifest.json` release checks tell the truth

**Status:** PROPOSED
**Date:** 2026-09-24
**ADR:** `plans/283-adr-release-gate-manifest-truth.md`
**Surfaced by:** GOAP-276 Phase 0 #5 (`scripts/validate-gate-parity.sh` warning observed while gating PR for P0 #5)
**Related:** GOAP-277 (`plans/277-goap-ci-gates-that-never-run.md`) — same defect class, different file; ADR-277 (fail-closed skip policy); ADR-282

## Goal

`scripts/gate-manifest.json` → `release.checks` declares eight "Required release
readiness checks". A live grep of `.github/workflows/release.yml` shows **six of
the eight strings occur zero times**, so the parity validator can never confirm
them and they are effectively unverifiable claims about what protects a release.

## Evidence (2026-09-24, `grep -c` against `release.yml`)

| Manifest claim | Hits | Reality |
| --- | --- | --- |
| `Release Readiness` | >0 | ✅ job `Release Readiness Gate` |
| `Performance Budgets` | >0 | ✅ job `Performance Budgets` |
| `Tag/Version Agreement` | **0** | ✅ enforced by step `Verify tag matches VERSION file` — mis-named in manifest |
| `Main Ancestry` | **0** | ✅ enforced by step `Verify tag is on main branch` — mis-named in manifest |
| `Required PR Checks` | **0** | ✅ enforced by step `Verify CI checks passed` — mis-named in manifest |
| `Coverage Gate` | **0** | ❌ **no coverage gate exists in `release.yml`** |
| `Cross-Browser E2E` | **0** | ❌ **absent**; `ci.yml` only has `Scheduled Cross-browser E2E` (schedule-triggered) |
| `Security Checks` | **0** | ❌ **absent**; CodeQL / dep-scan run in `ci.yml`, not at release time |

Consumer audit: `gate-manifest.json` is read **only** by
`scripts/validate-gate-parity.sh` (parity) and
`scripts/validate-coverage-parity.sh` (asserts `local.checks` contains
`coverage-parity`). **`release.yml` never reads it.** Renaming entries therefore
has no workflow-side effect — but it also means today the manifest documents
release protections that the release workflow does not actually perform.

## Decomposition

- **A (rename, mechanical, low risk)** — point `Tag/Version Agreement`,
  `Main Ancestry`, `Required PR Checks` at the real `name:` values so the
  validator's `grep -qi` on normalized text resolves them (3 × ⚠ → ✓).
- **B (policy, needs ADR)** — for `Coverage Gate`, `Cross-Browser E2E`,
  `Security Checks` decide: **implement a real gate** in `release.yml`, or
  **retire the claim** and record the coverage/security/cross-browser assurance
  as living in `ci.yml` + the release step `Verify CI checks passed`.
- **C (enforcement)** — once A and B land, decide whether these `⚠` lines should
  escalate to `✗` (exit 1) so the manifest cannot rot again, consistent with
  ADR-277's fail-closed direction.

## Strategy

Sequential — B before A/C, because B's decision changes what A renames to and
whether three entries survive at all. No parallelism available (single file,
single validator).

## Constraints

- **Do not delete the three unmet claims to silence the warning.** Removing a
  claim so a sensor turns green is explicitly forbidden ("never weaken a sensor
  to obtain a passing result; fix the underlying cause"). The `⚠` output is the
  working signal and stays until B is decided.
- `release.yml` is supply-chain critical (cosign sign-blob, SLSA provenance,
  SBOM) — any change there needs the full workflow validation
  (`./scripts/validate-workflows.sh`: actionlint + zizmor) and SHA pinning
  per ADR-247.
- Tier 1: this plan must exist and be linked from the PR that surfaced it
  before that PR merges.

## Quality gate

`bash scripts/validate-gate-parity.sh` exits 0 with **zero `⚠` release lines**.
