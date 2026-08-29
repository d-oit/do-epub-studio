# GOAP-312 — Dependency Vulnerability Scanning in CI

Issue: [#312](https://github.com/d-oit/do-epub-studio/issues/312) — CLOSED 2026-05-26 (COMPLETED)
Status: **Implemented on main; verified this sprint.**

## Goal

Add dependency vulnerability scanning, SBOM generation, automated dependency
updates, and supply-chain score to CI.

## ADR

- **Chosen (as implemented)**: native tooling only — `pnpm audit --audit-level=high --ignore-registry-errors`
  (`ci.yml:161`, fails build on high/critical advisories), CycloneDX SBOM via
  `@cyclonedx/cyclonedx-npm` on every build (`ci.yml:448`) and signed+attested in
  releases (`release.yml:242`, `cosign sign-blob`, SLSA provenance subject),
  Dependabot with auto-merge (`.github/dependabot.yml`,
  `dependabot-auto-merge.yml`), OpenSSF Scorecard workflow (`scorecard.yml`).
- **Rejected**: Snyk GitHub Action — requires an external org token/secret the
  repo does not provision; `pnpm audit` + CodeQL already cover npm advisories.
  Recorded divergence from the issue body's "pnpm audit + Snyk" pairing.

## Acceptance → Evidence

| Acceptance | Evidence |
|---|---|
| CI fails on high-severity vulnerabilities | `ci.yml:160-161` audit step in the build job |
| SBOM generated on every build | `ci.yml:448-456` artifact upload; release path signs + publishes SBOM |
| Dependencies automatically updated | `.github/dependabot.yml` + `dependabot-auto-merge.yml` |
| Scorecard passes | `scorecard.yml`; Scorecard runs on current main conclude `success` (2026-08-29) |

## Effort

S (historical; verification only this sprint).
