# AGENTS.md

## Core References

- `plans/000-product-overview.md` – product charter and capability map
- `plans/001-goap-roadmap.md` – GOAP phases + TRIZ links
- `plans/002-006` – ADRs for stack, storage, auth, offline, annotations
- `plans/007-implementation-phases.md` – current execution phase
- `docs/coding-guide.md` – consolidated architecture + process decisions
- `agents-docs/*.md` – workflow, skills, hooks, context, learnings

## Workflow (MANDATORY)

1. **Learn** – load memory context first: run `learn` skill or check `agents-docs/LEARNINGS.md` for prior discoveries.
2. **Read** – review AGENTS + relevant plans/ADRs/skills before touching code.
3. **Plan** – update `plans/` (and `plans/007` tracker) prior to implementation; use `task-decomposition` for complex work.
4. **Execute** – keep changes atomic, <500 LOC per source file, zero silent failures.
5. **Verify** – run full verification workflow (see **Verify Workflow** section below).
6. **Commit** – use `./scripts/atomic-commit/run.sh --message "type(scope): description"`.
7. **Learn** – always run the `learn` skill after non-trivial work to capture discoveries.

---

## Verify Workflow (MANDATORY)

**Before every commit, run the complete verification sequence:**

### Step 1: Pre-Verification Context Load

```bash
# Load prior learnings (choose one)
# Option A: Use learn skill (recommended)
skill learn

# Option B: Manual check
cat agents-docs/LEARNINGS.md
```

### Step 2: Run Quality Gate

```bash
./scripts/quality_gate.sh
```

The quality gate runs **all** checks in sequence:

1. Git hooks configuration validation
2. GitHub Actions SHA validation
3. Skill symlink validation (`validate-skills.sh`)
4. SKILL.md format validation (`validate-skill-format.sh`)
5. Reference link validation (`validate-links.sh`)
6. Language detection (TypeScript, Python, Shell, Markdown)
7. Language-specific checks (lint, typecheck, test)

**Exit codes:**

- `0` = all checks passed (silent success)
- `2` = errors surfaced to agent for remediation

### Step 3: Fix ALL Issues (No Exceptions)

When the quality gate fails:

1. **Read the error output** – each failure is printed with file path and details
2. **Fix every error and warning** – including pre-existing issues in files you touched
3. **Re-run quality gate** – repeat until all checks pass
4. **Document unfixable issues** – if an issue cannot be fixed, add to `agents-docs/KNOWN-ISSUES.md`

### Step 4: Use Correct Skills for Verification

| Issue Type | Skill to Use | Purpose |
|------------|--------------|---------|
| Code smells/DRY violations | `code-quality` | Inline refactoring at file level |
| PR-level diff analysis | `code-review-assistant` | Cross-file impact assessment |
| Shell script issues | `shell-script-quality` | ShellCheck fixes, BATS tests |
| Security vulnerabilities | `security-code-auditor` | Auth, EPUB, signed URL audits |
| Architecture contradictions | `triz-analysis` → `triz-solver` | Design trade-off resolution |
| UI/copy generic patterns | `anti-ai-slop` | Humanize UI text |

### Step 5: Document Unfixable Issues

If a warning cannot be fixed due to tool/library limitations:

1. Create entry in `agents-docs/KNOWN-ISSUES.md` with:
   - Exact error message
   - Affected file(s)
   - Reason why it cannot be fixed
   - Mitigation strategy
2. Verify the issue is truly unfixable (not just difficult)
3. Re-run quality gate to confirm no new failures

### Step 6: Final Verification Before Commit

```bash
# Full atomic commit workflow (includes verification)
./scripts/atomic-commit/run.sh --message "type(scope): description"

# Or dry-run to verify without committing
./scripts/atomic-commit/run.sh --dry-run
```

---

## Quality Gate Reference

| Check | Script | Dependencies | Exit on Fail |
|-------|--------|--------------|--------------|
| Git hooks config | `validate-git-hooks.sh` | git | Non-blocking warning |
| GitHub Actions SHAs | `validate-github-actions-shas.sh` | none | Exit 2 |
| Skill symlinks | `validate-skills.sh` | none | Exit 2 |
| SKILL.md format | `validate-skill-format.sh` | none | Exit 1 |
| Reference links | `validate-links.sh` | perl | Exit 2 |
| TypeScript lint | `pnpm lint` | pnpm | Exit 2 |
| TypeScript check | `pnpm typecheck` | pnpm | Exit 2 |
| Tests | `pnpm test` | pnpm | Exit 2 |
| Shell scripts | shellcheck | shellcheck | Exit 2 |
| Markdown | markdownlint | markdownlint | Exit 2 |

**No escape hatches exist.** If a check fails, fix the root cause.

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

## Pre-existing Issues Policy (MANDATORY)

- **Never ignore warnings or errors.** Every lint warning, typecheck warning, and test failure must be fixed.
- **Never skip or disable rules without justification.** If a lint rule is disabled (via `eslint-disable`), add an inline comment explaining why it's intentional.
- **Fix pre-existing issues when encountered.** When working in a file with pre-existing lint/type/test issues, fix them as part of the same change. Do not leave them for "later."
- **Document unfixable issues.** If a warning cannot be fixed due to tool/library limitations, document it in `agents-docs/KNOWN-ISSUES.md` with: the warning message, why it can't be fixed, and any mitigation strategy.
- **Skills must pass validation.** Every SKILL.md must have `version`, `category`, be under 250 lines, and have all symlinks in place.
- **Quality gate must pass.** No commit without passing `pnpm lint`, `pnpm typecheck`, `pnpm test`. Skill validation failures must also be resolved.

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

## Skills (On-Demand Loading)

Use the `skill` tool to load skills on-demand. At startup, only skill names/descriptions are loaded (~50 tokens each). Full SKILL.md content (~500-2000 tokens) loads only when needed.

**Available skills** (discovery catalog):

### Coordination (mandatory orchestration)

- `triz-analysis` — Identify contradictions before architecture/permissions/offline/EPUB decisions
- `triz-solver` — Resolve contradictions after triz-analysis completes
- `task-decomposition` — Break complex requests into atomic, testable sub-tasks
- `parallel-execution` — Run independent tasks simultaneously via agent coordination
- `learn` — Extract non-obvious discoveries after non-trivial work

### Backend/domain

- `cloudflare-worker-api` — Structure Worker routes and typed handlers (not auth)
- `secure-invite-and-access` — Grants, Argon2id, sessions, signed URLs per ADR-004
- `turso-schema-migrations` — Schema design and migration scripts for Turso
- `pwa-offline-sync` — Cache Storage + IndexedDB strategy per ADR-005

### Reader/UI

- `epub-rendering-and-cfi` — EPUB.js rendering and annotation anchoring per ADR-006
- `reader-ui-ux` — Localized, accessible reader/admin UI with Zustand

### Testing/data

- `testing-strategy` — Plan test coverage, pyramid ratios, Vitest/Playwright strategy
- `testdata-builders` — Deterministic builders for schema entities
- `dogfood` — Systematically explore and test a web application to find bugs, UX issues

### Quality/security

- `code-quality` — Inline code smells, refactoring, DRY violations (file-level)
- `code-review-assistant` — PR-level diff analysis, risk, cross-file impact
- `security-code-auditor` — Read-only vulnerability audits (auth, EPUB, signed URLs)
- `shell-script-quality` — Safe, portable shell authoring patterns
- `anti-ai-slop` — Audit/fix generic AI aesthetic in UI, copy, and UX
- `agent-browser` — Browser automation for web interaction, scraping, testing

### Utility

- `skill-creator` — Create and edit skills per agentskills.io spec
- `skill-evaluator` — Evaluate skill output quality with `expected_output` evals
- `memory-context` — Retrieve past learnings via csm CLI (falls back to grep)

## Learnings Mandate

- Capture non-obvious discoveries (fragile config, tool quirks, performance
  findings) via `learn` skill per task.
- No trivial or duplicate learnings; focus on actionable insights.
- Project-wide learnings are stored in `agents-docs/LEARNINGS.md` (not in
  this file).
