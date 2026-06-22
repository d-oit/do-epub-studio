# Release Process

> **Governance:** ADR-035b (Release Governance) and ADR-104
> (Product Identity and Version Governance). Releases are cut via
> the `release-management` skill — no manual tags, no direct
> CHANGELOG edits.

## Versioning

Version source of truth: `VERSION` file at repo root. The
`scripts/check-app-identity.mjs` guard (wired into
`./scripts/quality_gate.sh`) fails CI on any drift between
`VERSION`, every `package.json` `version` field, and the highest
released version recorded in `CHANGELOG.md`.

Uses Semantic Versioning with Conventional Commits:

- `fix(...)` → patch
- `feat(...)` → minor
- `feat(...)!` or `BREAKING CHANGE:` → major

## Cutting a Release

1. Run quality gate: `./scripts/quality_gate.sh`
2. Open PR with title `chore(release): vX.Y.Z`
3. On PR merge, release-drafter auto-publishes tag + GitHub Release
4. Verify: `https://github.com/d-oit/do-epub-studio/releases`

## Changelog

`CHANGELOG.md` is the single changelog source. The
`[Unreleased]` section accumulates Conventional Commits since the
last release; a release PR promotes it to a dated `## [X.Y.Z]`
heading. Never edit a release section by hand — open a follow-up
PR if a release entry is wrong.

## First Release (v0.1.0)

Collapse current `[Unreleased]` entries into `## [0.1.0] - 2026-05-17`.

## Identity

The canonical product name is `d.o.EPUB Studio` (short: `d.o.EPUB`).
These strings live only in `apps/web/src/config/app-identity.json`
and are imported at runtime (ADR-102). The identity guard
(`scripts/check-app-identity.mjs`) blocks any other spelling from
landing in tracked source/docs.
