# `do-epub-studio` — Coding Guide

Authoritative product definition, architecture, configuration, and delivery rules.
Detailed topics live in focused sub-documents linked in the table below.

> **New to the codebase?** Start at [`docs/ONBOARDING.md`](./ONBOARDING.md).

## Document map

| Topic | File |
|---|---|
| Project overview + architecture decisions | [`docs/architecture.md`](./architecture.md) |
| Coding conventions, naming, TypeScript patterns | [`docs/conventions.md`](./conventions.md) |
| Banned patterns (raw regex, `any`, unsafe EPUB rendering…) | [`docs/banned-patterns.md`](./banned-patterns.md) |
| Security model (session tokens, signed URLs, CSP) | [`docs/security.md`](./security.md) |
| Offline architecture (IndexedDB, Cache Storage, sync queue) | [`docs/offline.md`](./offline.md) |
| API reference (all Hono routes) | [`docs/api.md`](./api.md) |
| Accessibility requirements | [`docs/accessibility.md`](./accessibility.md) |
| Local dev setup | [`docs/setup-local.md`](./setup-local.md) |
| Cloudflare setup | [`docs/setup-cloudflare.md`](./setup-cloudflare.md) |
| Turso setup | [`docs/setup-turso.md`](./setup-turso.md) |
| ADR index | [`plans/ADR-INDEX.md`](../plans/ADR-INDEX.md) |
| Agent rules, quality gates, compliance self-check | [`AGENTS.md`](../AGENTS.md) |

---

## 1. Product definition

`d.o.EPUB Studio` — web-based EPUB reading and editorial workspace. See [`docs/architecture.md` — Product Definition](./architecture.md#product-definition) for the full feature list and use cases.

## 2. Final architecture decisions

See [`docs/architecture.md`](./architecture.md) for the technology table, data flow, auth flow, and adapter pattern.

**Stack:** TypeScript + Vite + React 19 | Cloudflare Workers + Hono | Turso/libSQL | Cloudflare R2 | IndexedDB + Cache Storage | Zustand 5 | Zod 4 | Vitest 4 + Playwright | Tailwind CSS 4.

## 3. Core capability model

MVP scope and later phases: see [`docs/architecture.md` — Product Definition](./architecture.md#product-definition).

## 4. Permission and access model

Roles (`admin`, `editor`, `reader`), access modes, and capability flags: see [`docs/architecture.md` — Permission and Access Model](./architecture.md#permission-and-access-model).

## 5. End-to-end user flows

**Admin:** login → create book → upload EPUB to R2 → create access grant → invite email sent → audit log updated.

**Reader:** open invite URL → email + optional password → session issued → signed EPUB URL → app reads EPUB → state stored locally → syncs online.

**Editorial:** select passage → anchor created → add comment → queued if offline → syncs online → others see thread → resolved or moderated.

## 6. Data model

Core tables: `users`, `books`, `book_files`, `book_access_grants`, `reader_sessions`, `reading_progress`, `bookmarks`, `highlights`, `comments`, `audit_log`. Full SQL: [`docs/architecture.md` — Core Database Schema](./architecture.md#core-database-schema). Locator strategy: EPUB CFI + selected text + chapter reference (not raw DOM offsets).

## 7. API design

All Hono route definitions: [`docs/api.md`](./api.md). Route groups: `/api/access/*`, `/api/books/*`, `/api/comments/*`, `/api/admin/*`, `/api/files/*`.

## 8. Monorepo structure

```text
do-epub-studio/
├─ AGENTS.md / CLAUDE.md / plans/ / docs/ / .agents/skills/
├─ apps/web/          # React SPA (Vite, Tailwind, PWA)
├─ apps/worker/       # Cloudflare Workers API (Hono, Turso, R2)
├─ apps/tests/        # Playwright E2E suite
└─ packages/schema/ shared/ ui/ reader-core/ testkit/
```

Package content rules: [`docs/architecture.md` — Package Boundaries](./architecture.md#package-boundaries).

---

## 9. Configuration and secrets model

Do not use a single root `.env`. Split:

| Config kind | Location |
|---|---|
| Worker runtime | `apps/worker/wrangler.jsonc` |
| Worker deployed secrets | `wrangler secret put <KEY>` |
| Worker local dev | `apps/worker/.dev.vars` (gitignored) |
| Frontend public config | `apps/web/.env.local` (VITE_ prefixed, gitignored) |
| DB provisioning | Turso CLI |

Secrets: `TURSO_AUTH_TOKEN`, `SESSION_SIGNING_SECRET`, `INVITE_TOKEN_SECRET`. Full setup: [`docs/setup-cloudflare.md`](./setup-cloudflare.md) + [`docs/setup-turso.md`](./setup-turso.md).

## 10. Wrangler configuration

Use `apps/worker/wrangler.jsonc`. Wire `APP_BASE_URL` + `TURSO_DATABASE_URL` as `vars`; use R2 binding `BOOKS_BUCKET`; never put raw storage credentials in env. See [`docs/setup-cloudflare.md`](./setup-cloudflare.md).

## 11. Secrets handling

Worker-only (`TURSO_AUTH_TOKEN`, `SESSION_SIGNING_SECRET`, `INVITE_TOKEN_SECRET`) — provision with `wrangler secret put <KEY>`. Never expose to browser.

## 12. Local development config

Copy `apps/worker/.dev.vars.example` → `.dev.vars`; `apps/web/.env.local.example` → `.env.local`. Neither is committed. Full walkthrough: [`docs/setup-local.md`](./setup-local.md).

## 13. Agent coding workflow

Full 7-step checklist + specialist agent roles: [`docs/conventions.md` — AI-agent execution model](./conventions.md#ai-agent-execution-model). Quick: load LEARNINGS, update plans before code, `vitest --run` for CI, run `./scripts/quality_gate.sh` before commit.

## 14. R2 best practice

Use Wrangler bindings (`env.BOOKS_BUCKET`); do not put raw object storage credentials into Worker env.

## 15. `.gitignore`

Never commit `**/.env.local`, `**/.dev.vars`, `node_modules`, `coverage`, `.playwright`. Commit only `*.example` files.

## 16. AGENTS.md

See [`AGENTS.md`](../AGENTS.md) — the live authoritative agent rules at repo root.

## 17. Reusable agent skills

Skills under `.agents/skills/`, loaded on-demand. Run `./scripts/validate-skills.sh` to verify integrity. Full list: [`AGENTS.md` — Skills Reference](../AGENTS.md#skills-reference).

## 18. GOAP implementation plan

Ordered phases — Foundation → Domain & schema → Access backend → Reader MVP → Offline support → Editorial features → Admin UI → Hardening. See [`plans/ADR-INDEX.md`](../plans/ADR-INDEX.md) + `plans/archive/001-goap-roadmap.md`.

## 19. ADRs

See [`plans/ADR-INDEX.md`](../plans/ADR-INDEX.md). Key ADRs: `002` (monorepo stack), `003` (storage model), `004` (auth & access), `005` (offline sync), `006` (annotation model), `034` (ReDoS), `063` (design tokens), `092` (auth transport).

## 20. Frontend design rules

Layout, reader controls, accessibility, UI copy, and Tailwind/OKLCH patterns: [`docs/conventions.md` — Frontend design rules](./conventions.md#frontend-design-rules).

## 21. Backend security rules

No user-existence leakage; generic denied responses; rate limiting; Argon2id; short-lived sessions; signed R2 URLs; MIME validation; sanitised EPUB HTML. Full details: [`docs/security.md`](./security.md) + [`docs/banned-patterns.md`](./banned-patterns.md).

## 22. Offline architecture

Dual-cache (Cache Storage + IndexedDB), sync queue, conflict rules: [`docs/offline.md`](./offline.md).

## 23. Testing strategy

Unit (Vitest), integration (Worker routes), E2E (Playwright), coverage thresholds: [`docs/conventions.md` — Testing strategy](./conventions.md#testing-strategy).

## 24. Package boundaries

[`docs/architecture.md` — Package Boundaries](./architecture.md#package-boundaries).

## 25. Recommended package scripts

Root `package.json` scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`, `verify`, `db:*`): [`docs/conventions.md` — Package scripts](./conventions.md#package-scripts).

## 26. CI requirements

Install → lint → typecheck → tests → build; Playwright on preview/gated branch; quality gate blocking. Details: [`docs/conventions.md` — CI requirements](./conventions.md#ci-requirements) + `AGENTS.md` Tier 2.

## 27. First vertical slice

Scaffold + AGENTS.md + plans/ADRs + initial schema (books, book_files, book_access_grants, reader_sessions, reading_progress) + admin create/grant + EPUB upload to R2 + access request route + session + signed URL + reader shell with save/restore.

**Acceptance criteria:** admin creates private book; grants one email; reader authenticates, opens EPUB, progress persists; revoked grant blocks; lint + typecheck + tests + build pass.

## 28. AI-agent execution model

Orchestrator, specialist agents, and agent rules: [`docs/conventions.md` — AI-agent execution model](./conventions.md#ai-agent-execution-model).

## 29. Product naming inside the UI

Reader modes, admin labels, editorial labels (en + de): [`docs/conventions.md` — UI copy](./conventions.md#ui-copy).

## 30. Risks and mitigations

Anchor drift, offline conflict, grant leakage, auth complexity, storage mistakes: [`docs/architecture.md` — Risks and Mitigations](./architecture.md#risks-and-mitigations).

## 31. Definition of done

11-point checklist including plan check, 500 LOC limit, quality gate, no generated artefacts committed: [`docs/conventions.md` — Definition of done](./conventions.md#definition-of-done).

## 32. Final recommendation

Private GitHub repo, pnpm + turbo monorepo, `apps/web` + `apps/worker` + `packages/*`, Cloudflare Workers + R2 + Turso, `wrangler.jsonc`, Wrangler secrets, `.dev.vars` local dev, `.env.local` browser-safe, EPUB.js MVP, IndexedDB + Cache Storage offline, `AGENTS.md` + `plans/` for AI execution.

**Best first milestone:** one private EPUB, one approved reader grant, one authenticated reading session, one offline-capable resume flow.
