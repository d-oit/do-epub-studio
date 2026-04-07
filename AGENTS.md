# AGENTS.md

## Purpose

This repository builds `d.o. EPUB Studio`, a production-grade EPUB reading and editorial workspace with gated access, offline reading, comments, highlights, and secure distribution.

## Mandatory working style

- Read before write.
- Plan first, then execute.
- Use TRIZ-first for all non-trivial tasks.
- Identify contradictions → resolve with TRIZ principles → then design.
- Keep ADRs and phase plans in `plans/`.
- Verify every important architectural decision before implementation.
- Use analysis swarm mindset when reviewing key changes:
  - methodical validator
  - rapid challenger
  - skeptical reviewer
- Do not update source-of-truth documentation until implementation is verified.

## Hard Rule

If a task involves architecture, permissions, offline sync, or EPUB rendering:
- STOP
- Run `triz-analysis` first
- Then run `triz-solver`
- Update `plans/` before any code

No exceptions.

## Constraints

- Max 500 LOC per source file.
- No hardcoded secrets.
- No hardcoded environment-specific URLs.
- No silent failures.
- No `any` unless justified and isolated.
- No skipping tests for core permission, sync, or auth flows.
- No direct public file URLs for private books.
- No unsafe EPUB HTML rendering.
- Use atomic git commit after every todo / task

## Architecture rules

- Store EPUB files in object storage, not as primary Turso blobs.
- Turso stores app state, permissions, progress, comments, highlights, and audit logs.
- Browser stores offline state first; sync is explicit and resilient.
- Signed URLs must be short-lived.
- Access validation must happen in the app backend.
- Annotation anchors must use robust locators, not raw DOM offsets alone.

## Configuration rules

- Use `wrangler.jsonc` for new Worker projects.
- Do not use a single generic `.env` as the main project config model.
- For `apps/worker`, use `wrangler.jsonc`, `wrangler secret put`, and `.dev.vars` for local development.
- For `apps/web`, use `.env.local` only for safe browser-visible values.
- Never expose Turso auth tokens or signing secrets to the frontend.
- Prefer Cloudflare bindings for R2 over raw object storage credentials.
- Use Turso CLI for provisioning and admin tasks, not as a replacement for Worker runtime configuration.
- Commit only example config files, never live secret files.

## Coding rules

- TypeScript everywhere by default.
- Zod for validation at boundaries.
- Zustand for client state.
- Vitest for unit and integration tests.
- Playwright for end-to-end tests.
- Tailwind for styling.
- Prefer pure functions for domain logic.
- Keep service interfaces small and explicit.
- Use dependency injection where it simplifies testing.
- Create test data builders for grants, books, comments, and sessions.

## Security rules

- Hash passwords using a strong KDF.
- Sanitize all rendered EPUB content.
- Validate file type and size on upload.
- Log permission grants, revocations, and access-sensitive changes.
- Use audit logs for admin actions.
- Avoid user enumeration in auth responses.
- Revoke sessions on permission revocation.

## Delivery rules

A task is complete only when:
- plan updated if needed
- implementation done
- lint passes
- typecheck passes
- tests pass
- build passes
- docs updated if behavior changed
