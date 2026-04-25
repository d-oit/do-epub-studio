# Release Workflow

This document describes the release process for `do-epub-studio`.

## Release Criteria

A release is ready to be published when:

1.  **Green CI**: All checks in the `CI` workflow pass on the `main` branch.
2.  **Passing Quality Gate**: The `./scripts/quality_gate.sh` script runs successfully without any errors.
3.  **Updated Version**: The `VERSION` file and all `package.json` files are synchronized with the target version.
4.  **Updated Changelog**: `CHANGELOG.md` is updated with the changes since the last release.
5.  **Documentation Baseline**: Any new features or architectural changes are documented in `README.md` and the `plans/` or `docs/` directories.

## Versioning Strategy

We follow [Semantic Versioning (SemVer)](https://semver.org/):

-   `vX.Y.Z`
-   Major version (`X`): Incompatible API changes.
-   Minor version (`Y`): Functionality added in a backwards-compatible manner.
-   Patch version (`Z`): Backwards-compatible bug fixes.

For pre-releases, we use tags like `vX.Y.Z-alpha.N` or `vX.Y.Z-beta.N`.

## Release Process

1.  **Update Version**:
    -   Update the `VERSION` file in the root directory.
    -   Update `version` in the root `package.json`.
    -   Update `version` in all workspace `package.json` files (e.g., `apps/web`, `apps/worker`, `packages/*`).
2.  **Update Changelog**:
    -   Add a new entry to `CHANGELOG.md` for the target version.
    -   Summarize major features, bug fixes, and breaking changes.
3.  **Run Quality Gate**:
    -   Execute `./scripts/quality_gate.sh` locally.
4.  **Commit and Push**:
    -   Commit the version and changelog updates.
    -   Push to `main`.
5.  **Tag the Release**:
    -   Create a git tag for the version (e.g., `git tag v0.1.0`).
    -   Push the tag to GitHub (e.g., `git push origin v0.1.0`).
6.  **Verify Release Workflow**:
    -   The `Release` workflow in GitHub Actions will trigger automatically on the tag push.
    -   Verify that the workflow completes successfully, deploying the worker and creating the GitHub release.

## Manual Trigger

If needed, the release workflow can be triggered manually via the GitHub Actions UI using the `workflow_dispatch` event.
