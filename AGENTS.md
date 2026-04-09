# AGENTS.md

> Single source of truth for every AI agent and workflow in `do EPUB Studio`.

## Core References

- `plans/000-product-overview.md` – product charter and capability map
- `plans/001-goap-roadmap.md` – GOAP phases + TRIZ links
- `plans/002-006` – ADRs for stack, storage, auth, offline, annotations
- `plans/007-implementation-phases.md` – current execution phase
- `docs/coding-guide.md` – consolidated architecture + process decisions
- `agents-docs/*.md` – workflow, skills, hooks, context, learnings

## Workflow (MANDATORY)

1. **Read** – review AGENTS + relevant plans/ADRs/skills before touching code.
2. **Plan** – update `plans/` (and `plans/007` tracker) prior to implementation.
3. **Execute** – keep changes atomic, <500 LOC per source file, zero silent failures.
4. **Verify** – run `./scripts/quality_gate.sh` (lint + typecheck + test + build) and fix everything.
5. **Commit** – use `./scripts/atomic-commit/run.sh --message "type(scope): description"`.
6. **Learn** – always run the `learn` skill for non-trivial work.

## Hard Rules

- TRIZ-first for architecture/permissions/offline/EPUB: run `triz-analysis` → `triz-solver` → update plans.
- Enforce observability: every Worker request + critical UI action must emit structured logs w/ trace IDs.
- Enforce localization: UI copy, errors, and notifications must support `en`, `de`, `fr` with parity.
- No secrets, env URLs, or storage credentials in source; only `.dev.vars`/`.env.local` examples are committed.
- No direct R2 file URLs to clients; all access goes through Workers with short-lived signed URLs.
- Annotation anchors must use multi-signal locators (CFI + text + chapter) per ADR-006.
- Use Zod for boundary validation, Zustand for state, Tailwind for styling, Vitest + Playwright for tests.
- Never skip documenting coding workflow changes or new learnings.

## Constraints

- Max 500 LOC per source file.
- No hardcoded secrets.
- No hardcoded environment-specific URLs.
- No silent failures.
- No `any` unless justified and isolated.
- No skipping tests for core permission, sync, or auth flows.
- No direct public file URLs for private books.
- No unsafe EPUB HTML rendering.

## Architecture + Storage

- EPUB binaries/covers → Cloudflare R2 via signed URLs.
- Metadata, grants, sessions, annotations, audit → Turso (libSQL) with migrations in `packages/schema`.
- Offline cache → IndexedDB + Cache Storage with sync queue + zombie detection.
- Cloudflare Workers provide API/auth/signing; Vite PWA (EPUB.js) handles reader + admin UI.

## Config + Security

- Worker config lives in `apps/worker/wrangler.jsonc` + Wrangler secrets + `.dev.vars` (local only).
- Frontend config limited to safe `.env.local` values.
- Hash passwords with Argon2id, never leak whether a grant exists, revoke sessions immediately on grant change.
- Log grant/session/comment/audit events; include `traceId` + actor metadata.
- Keep audit-ready history in `audit_log`; no manual DB edits outside migrations.

## Observability + Error Handling

- Use shared telemetry helpers (`packages/shared`) to create `traceId`/`spanId`, serialize errors, and set `X-Trace-Id` headers.
- Worker `fetch` entrypoint must wrap all routes with global error handling + JSON responses containing the trace id.
- Web app must register global `error`/`unhandledrejection` handlers, wrap routes in an error boundary, and abort async work on cleanup to prevent leaks.
- Every API call sends trace + locale headers; Worker responses echo `X-Trace-Id`.

## Localization

- Store locale preference in Zustand; default to navigator language fallback `en`.
- Provide translations for English, German, French; show locale switcher in reader/admin/auth flows.
- Always send `Accept-Language` to APIs and mirror locale in UI copy + validation messages.

## Delivery Definition

- Plans/ADRs + skills updated if work impacts them.
- Implementation complete with observability + i18n + security considerations addressed.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` succeed (via quality gate).
- User-facing docs/README updated when behavior changes.
- `learn` skill entry committed with key takeaways.

## Skills

- Mandatory orchestration: `triz-analysis`, `triz-solver`, `task-decomposition`, `parallel-execution`, `learn`.
- Backend/domain: `cloudflare-worker-api`, `turso-schema-migrations`, `secure-invite-and-access`, `pwa-offline-sync`.
- Reader/UI: `epub-rendering-and-cfi`, `reader-ui-ux`.
- Testing/data: `testing-strategy`, `testdata-builders`.
- Quality/security: `code-quality`, `security-code-auditor`, `shell-script-quality`, `code-review-assistant`, `anti-ai-slop`.
- Utility: `skill-creator`, `skill-evaluator`, `memory-context`.

## Quality Gate

Run before every commit (no exceptions):

```bash
./scripts/quality_gate.sh
```

Set `SKIP_TESTS=true` only if explicitly approved.

## Learnings Mandate

- Capture non-obvious discoveries (fragile config, tool quirks, performance findings) via `learn` skill per task.
- No trivial or duplicate learnings; focus on actionable insights.
- Project-wide learnings are stored in `agents-docs/LEARNINGS.md` (not in this file).
