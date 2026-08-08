# GOAP Plan 052: Codebase Gap Analysis and Closure

**Date:** 2026-05-26
**Status:** ✅ Resolved — All 12 gaps closed in PR #358 (merged 2026-05-26)
**Strategy:** Hybrid: fix runtime blockers first, then CI/release/docs drift
**Related ADR:** `plans/052-adr-gap-closure-policy.md`

## Goal

Close the current gap between the documented product, the implemented admin
workflows, and the repository quality/release gates.

## Context

- `origin/main` was fetched and merged before analysis.
- Current branch: `docs/plan-update`.
- Latest GitHub release: `v0.1.0`, published with no assets.
- Open GitHub PRs/issues returned empty at analysis time.
- Latest CI on `main` is blocked by CodeQL, dependency audit, and pre-commit
  formatting failures.

## Findings

| ID  | Priority | Area                  | Finding                                                                                                                                                                                                              | Evidence                                                                                                                 |
| --- | -------: | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| G1  |       P0 | Admin auth            | Admin pages store `sessionToken` but most admin API calls do not send it, so protected admin endpoints return 401 after login.                                                                                       | `apps/web/src/features/admin/BooksPage.tsx`, `apps/web/src/features/admin/GrantsPage.tsx`, `apps/web/src/lib/api.ts`     |
| G2  |       P0 | Book creation         | The UI posts title/author/visibility, but `CreateBookSchema` requires `slug`; upload then uses raw `fetch(uploadUrl)` without admin authorization even though the Worker upload route is `adminAuth` protected.      | `apps/web/src/features/admin/BooksPage.tsx`, `apps/worker/src/routes/admin/books.ts`, `packages/schema/src/schemas.ts`   |
| G3  |       P0 | Grant creation/revoke | The UI omits `bookId`, sends unsupported modes (`read`, `comment`, `highlight`), and revokes with `DELETE /api/admin/grants/:id`; the Worker expects schema-valid body data and `POST /api/admin/grants/:id/revoke`. | `apps/web/src/features/admin/GrantsPage.tsx`, `apps/worker/src/routes/admin/grants.ts`, `packages/schema/src/schemas.ts` |
| G4  |       P1 | Admin routes          | The Books page navigates to `/admin/audit-logs`, but the SPA only registers `/admin/audit`. `/admin/grants` also remains in a loading state because no `bookId` exists.                                              | `apps/web/src/App.tsx`, `apps/web/src/features/admin/BooksPage.tsx`, `apps/web/src/features/admin/GrantsPage.tsx`        |
| G5  |       P0 | CI security           | CodeQL gate fails with one open alert: `js/incomplete-url-scheme-check` in `packages/reader-core/src/sanitizer.ts`.                                                                                                  | `gh api /code-scanning/alerts?state=open`                                                                                |
| G6  |       P0 | Dependency audit      | `pnpm audit --audit-level=high` fails on `serialize-javascript <=7.0.2` through `vite-plugin-pwa > workbox-build > @rollup/plugin-terser`.                                                                           | `pnpm audit --audit-level=high`                                                                                          |
| G7  |       P1 | Workflow validation   | Local `./scripts/validate-workflows.sh` cannot fully validate: `zizmor` install is blocked by the Python environment, and the Node `shellcheck` shim writes download logs that make actionlint fail.                 | `scripts/validate-workflows.sh`                                                                                          |
| G8  |       P1 | Scorecard             | OpenSSF Scorecard fails because the pinned `ossf/scorecard-action` SHA is treated as not belonging to the action repository.                                                                                         | `.github/workflows/scorecard.yml`, latest Scorecard run                                                                  |
| G9  |       P1 | Release metadata      | `VERSION` is `0.1.0`, but every workspace `package.json` remains `0.0.1`; the latest GitHub release has no assets.                                                                                                   | `VERSION`, `package.json`, `apps/*/package.json`, `packages/*/package.json`, `gh release view v0.1.0`                    |
| G10 |       P2 | README/docs           | README claims encrypted audit trails, but Worker audit payloads are stored as sanitized JSON, not encrypted. `SECURITY.md` contains stale ADR links and contradicts sandbox docs about `allow-scripts`.              | `README.md`, `apps/worker/src/audit/index.ts`, `SECURITY.md`, `docs/security.md`                                         |
| G11 |       P2 | AGENTS workflow       | `AGENTS.md` is under its 150-line ceiling, but has duplicate numbered items and a malformed bold disclosure bullet.                                                                                                  | `AGENTS.md`                                                                                                              |
| G12 |       P2 | Scripts docs          | `scripts/README.md` documents `validate-github-actions-shas.sh`, but the repo only has `validate-shas.sh`.                                                                                                           | `scripts/README.md`, `scripts/`                                                                                          |

## GOAP Decomposition

| Step | Priority | Task                                                                                      | Dependencies | Success criteria                                                                                                    |
| ---- | -------: | ----------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1    |       P0 | Repair admin API client token propagation for all admin pages and upload flow.            | none         | Admin book list/create/upload/grants/audit calls include admin bearer token.                                        |
| 2    |       P0 | Align book create contract: generate/send slug or move slug generation server-side.       | 1            | `CreateBookSchema` and UI request shape match; tests cover missing/duplicate slug behavior.                         |
| 3    |       P0 | Align grant create/update/revoke contracts and route methods.                             | 1            | Create, edit, revoke use schema-supported modes and Worker paths; session revocation remains immediate.             |
| 4    |       P1 | Normalize admin SPA routes and loading states.                                            | 1            | `/admin/audit`, `/admin/audit-logs`, `/admin/grants`, and book-scoped grants have deterministic UI states.          |
| 5    |       P0 | Fix CodeQL URL scheme alert in sanitizer with bounded URL parsing.                        | none         | CodeQL alert count for `main` is zero.                                                                              |
| 6    |       P0 | Remove vulnerable dependency path or override to patched `serialize-javascript`.          | none         | `pnpm audit --audit-level=high` exits zero.                                                                         |
| 7    |       P1 | Make workflow validation hermetic.                                                        | none         | `./scripts/validate-workflows.sh` installs/uses local pinned tools without system Python or read-only global shims. |
| 8    |       P1 | Fix Scorecard action pinning or disable publish mode until a verified action ref is used. | none         | Scorecard workflow completes without imposter-commit failure.                                                       |
| 9    |       P1 | Reconcile release version sources and release assets.                                     | 5, 6, 7      | `VERSION`, all package versions, changelog, release tag, and release artifacts agree.                               |
| 10   |       P2 | Correct README, SECURITY, AGENTS, and scripts docs drift.                                 | none         | Docs describe implemented behavior and link to existing files.                                                      |

## Quality Gates

Run in this order after implementation:

1. `pnpm audit --audit-level=high`
2. `./scripts/validate-workflows.sh`
3. `./scripts/minimal_quality_gate.sh`
4. `pnpm test:coverage`
5. Targeted admin route/UI tests for book creation, upload, grants, revoke, and audit navigation
6. `gh api '/repos/d-oit/do-epub-studio/code-scanning/alerts?state=open'`

## Notes

- Do not open public vulnerability issues for G5 or G6. Follow `SECURITY.md`.
- Avoid editing existing `plans/051-*` files unless their owner asks; they were already untracked before this analysis.
- Product fixes should land before docs cleanup so docs can describe actual behavior.
