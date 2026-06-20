# ADR 102 — Application Identity and Version Source

**Date:** 2026-06-20
**Status:** Accepted

## Context

The web app exposed the product name in multiple files and served a static
manifest with its own name and short name. The repo already contained a root
`VERSION` file, but runtime UI and generated metadata did not use it as the
single source for application version display.

## Decision

- Store the application display name in `apps/web/src/config/app-identity.json`.
- Store the application version only in the root `VERSION` file.
- Import the app identity and raw `VERSION` text from
  `apps/web/src/config/app-identity.ts` for React UI.
- Read the same two sources in `apps/web/vite.config.ts` for generated HTML and
  PWA manifest metadata.
- Remove the stale static `apps/web/public/manifest.json` so the generated PWA
  manifest is authoritative.

## Consequences

Renaming the application now requires one metadata edit. Version bumps continue
to flow through `VERSION`. Playwright coverage checks the document metadata,
generated manifest, and visible login shell so drift is caught in e2e tests.
