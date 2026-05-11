# `do-epub-studio` – Consolidated Coding Guide (2026)

This document captures the authoritative product definition, architecture, and delivery rules for `do EPUB Studio`. It mirrors the final decisions from the latest planning thread and supersedes older scattered notes.

---

# 1. Product definition

## Product name

- **Product:** `do EPUB Studio`
- **Repository:** `do-epub-studio`
- **GitHub repo target:** `d-oit/do-epub-studio`

## What the app is

`do EPUB Studio` is a web-based EPUB reading and editorial workspace for self-publishing, controlled distribution, and annotated review.

It is not just a reader.

It combines:

- EPUB reading
- gated access by email
- optional password protection
- public or private distribution
- offline reading as a PWA
- bookmarks and highlights
- editorial comments and threaded discussion
- audit logging and permission management

## Primary use cases

- author shares a manuscript EPUB with selected readers
- editor reviews EPUB with comments and discussion
- proofreaders access a protected draft
- selected readers get read-only access
- public sample books are exposed without grant approval
- readers continue offline and sync later

---

# 2. Final architecture decisions

## Recommended stack

| Layer                 | Choice                    | Why                                          |
| --------------------- | ------------------------- | -------------------------------------------- |
| Frontend              | TypeScript + Vite + PWA   | fast, modern, strong offline path            |
| Reader engine         | EPUB.js first             | pragmatic browser-first MVP                  |
| Backend/API           | Cloudflare Workers        | simple secure edge runtime                   |
| Database              | Turso                     | good fit for syncable SQLite-style app state |
| Object storage        | Cloudflare R2             | proper file storage for EPUB bytes           |
| Local browser storage | IndexedDB + Cache Storage | offline reading and queued sync              |
| State management      | Zustand                   | matches your stack preference                |
| Validation            | Zod                       | strong boundary validation                   |
| Testing               | Vitest + Playwright       | unit/integration/E2E                         |
| Styling               | Tailwind CSS              | fast, responsive UI system                   |
| CI/CD                 | GitHub Actions            | practical default                            |
| Frontend hosting      | Cloudflare Pages          | free tier, native CDN, easy Worker rewrites  |

## Why not store EPUB in Turso

Do not treat Turso as the primary EPUB file store.

Use Turso for:

- users
- book metadata
- grants
- sessions
- reading progress
- bookmarks
- highlights
- comments
- audit logs
- sync state

Use R2 for:

- EPUB file bytes
- covers
- derived file assets if needed

That separation is simpler, cheaper, and safer.

---

# 3. Core capability model

## MVP scope

- admin creates a book record
- admin uploads EPUB to R2
- admin grants access by email
- optional password on grant
- reader authenticates by email and optional password
- reader opens EPUB in browser
- reader position persists
- offline reading works after initial authenticated fetch
- bookmarks work
- highlights work
- comments work for editorial mode

## Later phases

- threaded comments and resolution
- expiring invites and revocation flows
- reviewer activity dashboard
- public catalog mode
- versioned manuscript releases
- export comments
- compare editions
- AI-assisted editorial workflows

---

# 4. Permission and access model

Use explicit roles and capability flags.

## Global roles

- `admin`
- `editor`
- `reader`

## Book access modes

- `private`
- `password_protected`
- `reader_only`
- `editorial_review`
- `public`

## Capabilities

- `can_read`
- `can_comment`
- `can_highlight`
- `can_download_offline`
- `can_export_notes`
- `can_manage_access`

## Access matrix

| Mode               | Read |            Comment |  Offline | Password | Public |
| ------------------ | ---: | -----------------: | -------: | -------: | -----: |
| private            |  yes |           optional | optional | optional |     no |
| password_protected |  yes |           optional | optional |      yes |     no |
| reader_only        |  yes |                 no | optional | optional |     no |
| editorial_review   |  yes |                yes |   yes/no | optional |     no |
| public             |  yes | optional by policy | optional |       no |    yes |

## Important rule

Do not rely on R2 visibility or storage permissions as the app’s main authorization system.

Private and restricted books must still be gated by application-level access rules and short-lived signed URLs.

---

# 5. End-to-end user flows

## Admin flow

1. admin logs in
2. admin creates a book
3. admin uploads EPUB
4. system stores file in R2
5. system extracts metadata if possible
6. admin creates access grants
7. admin sets:
   - email
   - optional password
   - access mode
   - comments allowed
   - offline allowed
   - expiry date

8. system optionally sends invite email
9. audit log records changes

## Reader flow

1. reader opens invite or book URL
2. reader enters email
3. reader enters password if required
4. backend validates grant
5. backend creates short-lived session
6. backend returns capabilities
7. reader requests signed EPUB URL
8. reader opens EPUB
9. app stores reading state locally first
10. when online, local state syncs

## Editorial flow

1. reviewer selects passage
2. app creates locator anchor
3. reviewer adds comment
4. if offline, comment enters sync queue
5. when online, comment syncs to backend
6. other reviewers or admin see thread
7. comment can be resolved or moderated

---

# 6. Data model

Use a pragmatic normalized schema.

## Core tables

- `users`
- `books`
- `book_files`
- `book_access_grants`
- `reader_sessions`
- `reading_progress`
- `bookmarks`
- `highlights`
- `comments`
- `audit_log`

## Example schema

### `users`

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    global_role TEXT NOT NULL DEFAULT 'reader',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### `books`

```sql
CREATE TABLE books (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author_name TEXT,
    description TEXT,
    language TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    cover_image_url TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
);
```

### `book_files`

```sql
CREATE TABLE book_files (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    storage_provider TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    sha256 TEXT,
    epub_version TEXT,
    manifest_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id)
);
```

### `book_access_grants`

```sql
CREATE TABLE book_access_grants (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT,
    mode TEXT NOT NULL,
    allowed INTEGER NOT NULL DEFAULT 1,
    comments_allowed INTEGER NOT NULL DEFAULT 0,
    offline_allowed INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    invited_by_user_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id)
);
```

### `reader_sessions`

```sql
CREATE TABLE reader_sessions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    email TEXT NOT NULL,
    session_token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY (book_id) REFERENCES books(id)
);
```

### `reading_progress`

```sql
CREATE TABLE reading_progress (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    locator_json TEXT NOT NULL,
    progress_percent REAL,
    updated_at TEXT NOT NULL,
    UNIQUE(book_id, user_email)
);
```

### `bookmarks`

```sql
CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    locator_json TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL
);
```

### `highlights`

```sql
CREATE TABLE highlights (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    chapter_ref TEXT,
    cfi_range TEXT,
    selected_text TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### `comments`

```sql
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    chapter_ref TEXT,
    cfi_range TEXT,
    selected_text TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    visibility TEXT NOT NULL DEFAULT 'shared',
    parent_comment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
);
```

### `audit_log`

```sql
CREATE TABLE audit_log (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL
);
```

## Locator strategy

For annotations and progress, prefer:

- EPUB CFI or equivalent robust locator
- selected text excerpt
- chapter reference

Do not rely only on raw DOM offsets.

---

# 7. API design

Keep routes narrow and explicit.

## Access routes

### `POST /api/access/request`

Input:

```json
{
  "bookSlug": "my-book",
  "email": "reader@example.com",
  "password": "optional"
}
```

Output:

```json
{
  "ok": true,
  "sessionToken": "token",
  "book": {
    "id": "book-id",
    "title": "My Book"
  },
  "capabilities": {
    "canRead": true,
    "canComment": true,
    "canDownloadOffline": true
  }
}
```

### `POST /api/access/logout`

### `POST /api/access/refresh`

## Book routes

### `GET /api/books/:slug`

### `POST /api/books/:bookId/file-url`

Returns a short-lived signed R2 URL.

## Reader state routes

### `PUT /api/books/:bookId/progress`

### `GET /api/books/:bookId/progress`

### `POST /api/books/:bookId/bookmarks`

### `GET /api/books/:bookId/bookmarks`

### `POST /api/books/:bookId/highlights`

### `GET /api/books/:bookId/highlights`

## Comment routes

### `POST /api/books/:bookId/comments`

### `GET /api/books/:bookId/comments`

### `PATCH /api/comments/:commentId`

### `POST /api/comments/:commentId/reply`

## Admin routes

### `POST /api/admin/books`

### `POST /api/admin/books/:bookId/upload-complete`

### `POST /api/admin/books/:bookId/grants`

### `PATCH /api/admin/grants/:grantId`

### `POST /api/admin/grants/:grantId/revoke`

### `GET /api/admin/books/:bookId/audit`

---

# 8. Monorepo structure

```text
do-epub-studio/
├─ AGENTS.md
├─ README.md
├─ LICENSE
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json
├─ eslint.config.js
├─ vitest.workspace.ts
├─ playwright.config.ts
├─ .editorconfig
├─ .prettierrc.json
├─ .gitignore
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     ├─ preview.yml
│     └─ release.yml
├─ plans/
│  ├─ 000-product-overview.md
│  ├─ 001-goap-roadmap.md
│  ├─ 002-adr-monorepo-stack.md
│  ├─ 003-adr-storage-model.md
│  ├─ 004-adr-auth-and-access.md
│  ├─ 005-adr-offline-sync.md
│  ├─ 006-adr-annotation-model.md
│  └─ 007-implementation-phases.md
├─ docs/
│  ├─ architecture.md
│  ├─ api.md
│  ├─ security.md
│  ├─ offline.md
│  ├─ accessibility.md
│  ├─ setup-local.md
│  ├─ setup-cloudflare.md
│  └─ setup-turso.md
├─ .agents/
│  └─ skills/
│     ├─ cloudflare-worker-api/
│     │  └─ SKILL.md
│     ├─ turso-schema-migrations/
│     │  └─ SKILL.md
│     ├─ epub-rendering-and-cfi/
│     │  └─ SKILL.md
│     ├─ pwa-offline-sync/
│     │  └─ SKILL.md
│     ├─ secure-invite-and-access/
│     │  └─ SKILL.md
│     ├─ reader-ui-ux/
│     │  └─ SKILL.md
│     └─ testdata-builders/
│        └─ SKILL.md
├─ apps/
│  ├─ web/
│  │  ├─ .env.local.example
│  │  ├─ public/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ components/
│  │  │  ├─ features/
│  │  │  ├─ lib/
│  │  │  ├─ routes/
│  │  │  ├─ stores/
│  │  │  ├─ styles/
│  │  │  └─ workers/
│  │  ├─ tests/
│  │  ├─ index.html
│  │  └─ vite.config.ts
│  └─ worker/
│     ├─ wrangler.jsonc
│     ├─ .dev.vars.example
│     ├─ src/
│     │  ├─ routes/
│     │  ├─ services/
│     │  ├─ db/
│     │  ├─ auth/
│     │  ├─ storage/
│     │  └─ lib/
│     └─ tests/
├─ packages/
│  ├─ schema/
│  │  ├─ src/
│  │  └─ migrations/
│  ├─ shared/
│  │  └─ src/
│  ├─ ui/
│  │  └─ src/
│  ├─ reader-core/
│  │  └─ src/
│  └─ testkit/
│     └─ src/
└─ scripts/
   ├─ verify.mjs
   ├─ bootstrap.mjs
   ├─ db-migrate-local.mjs
   ├─ db-migrate-prod.mjs
   └─ db-check.mjs
```

---

# 9. Configuration and secrets model

## Final rule

Do not use a single generic root `.env` as the main config model.

Use this split:

- **Worker runtime config:** `wrangler.jsonc`
- **Worker deployed secrets:** `wrangler secret put`
- **Worker local dev secrets/config:** `.dev.vars`
- **Frontend public config:** `.env.local`
- **database provisioning:** Turso CLI

## Why this is the right model

- matches Cloudflare-native deployment
- keeps secrets out of frontend and repo
- separates browser-safe and server-only config
- keeps local development simple
- leaves room for environment-specific deployment

---

# 10. Wrangler configuration

Because Wrangler supports both TOML and JSON/JSONC, and Cloudflare recommends JSONC for new projects, use:

- **`apps/worker/wrangler.jsonc`**

## Recommended `wrangler.jsonc`

```jsonc
{
  "name": "do-epub-studio-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-07",

  "vars": {
    "APP_BASE_URL": "https://do-epub-studio.example.com",
    "TURSO_DATABASE_URL": "libsql://do-epub-studio-your-org.turso.io",
  },

  "r2_buckets": [
    {
      "binding": "BOOKS_BUCKET",
      "bucket_name": "do-epub-studio-books",
    },
  ],
}
```

## Notes

- `APP_BASE_URL` is fine in `vars`
- `TURSO_DATABASE_URL` is typically acceptable in `vars`
- secrets should not live in this file
- use R2 bindings rather than raw storage credentials

---

# 11. Secrets handling

Use Cloudflare secrets for:

- `TURSO_AUTH_TOKEN`
- `SESSION_SIGNING_SECRET`
- `INVITE_TOKEN_SECRET`

Example commands:

```bash
wrangler secret put TURSO_AUTH_TOKEN
wrangler secret put SESSION_SIGNING_SECRET
wrangler secret put INVITE_TOKEN_SECRET
```

These are Worker-only values.

Do not expose them to the browser.

---

# 12. Local development config

## `apps/worker/.dev.vars.example`

```env
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
SESSION_SIGNING_SECRET=
INVITE_TOKEN_SECRET=
APP_BASE_URL=http://127.0.0.1:5173
```

## Local `apps/worker/.dev.vars`

```env
TURSO_DATABASE_URL=libsql://do-epub-studio-your-org.turso.io
TURSO_AUTH_TOKEN=local-dev-token
SESSION_SIGNING_SECRET=local-dev-session-secret
INVITE_TOKEN_SECRET=local-dev-invite-secret
APP_BASE_URL=http://127.0.0.1:5173
```

## `apps/web/.env.local.example`

```env
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_APP_NAME=do EPUB Studio
```

## `apps/web/.env.local`

```env
VITE_API_BASE_URL=http://127.0.0.1:8787
VITE_APP_NAME=do EPUB Studio
```

---

# 13. Turso CLI workflow

Turso CLI is for provisioning and operations.

It does not replace Worker runtime configuration.

## Use it for

- create database
- inspect database
- create auth token
- operational management

## Example flow

```bash
turso db create do-epub-studio
```

Take the resulting values and wire them into:

- `wrangler.jsonc` for non-secret config
- `wrangler secret put` for secrets
- `.dev.vars` for local development

---

# 14. R2 best practice

Use Wrangler bindings for R2.

Do not put raw object storage credentials into Worker env unless there is no other option.

## Why

- cleaner Cloudflare-native model
- fewer exposed secrets
- simpler Worker code
- safer deployment model

---

# 15. Example `.gitignore`

```gitignore
# local config
**/.env.local
**/.dev.vars

# node
node_modules
coverage
.playwright
```

Commit only:

- `.env.local.example`
- `.dev.vars.example`

Do not commit real secret files.

---

# 16. `AGENTS.md` starter

Use this at repo root.

```md
# AGENTS.md

## Purpose

This repository builds `do EPUB Studio`, a production-grade EPUB reading and editorial workspace with gated access, offline reading, comments, highlights, and secure distribution.

## Mandatory working style

- Read before write.
- Plan first, then execute.
- Use GOAP thinking for every non-trivial task.
- Keep ADRs and phase plans in `plans/`.
- Verify every important architectural decision before implementation.
- Use analysis swarm mindset when reviewing key changes:
  - methodical validator
  - rapid challenger
  - skeptical reviewer
- Do not update source-of-truth documentation until implementation is verified.

## Constraints

- Max 500 LOC per source file.
- No hardcoded secrets.
- No hardcoded environment-specific URLs.
- No silent failures.
- No `any` unless justified and isolated.
- No skipping tests for core permission, sync, or auth flows.
- No direct public file URLs for private books.
- No unsafe EPUB HTML rendering.

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
```

---

# 17. Reusable agent skills

Create skills under `.agents/skills/` following the on-demand loading pattern (per AGENTS.md).
Use the `skill(name="skill-name")` tool to load full SKILL.md content when needed.

At startup, only skill names/descriptions are loaded (~50 tokens each). Full SKILL.md content
(~500-2000 tokens) loads only when the agent determines the skill is relevant.

## Core skills (see AGENTS.md for full list)

- `triz-analysis`, `triz-solver` — TRIZ contradiction resolution
- `cloudflare-worker-api` — Worker route structure
- `turso-schema-migrations` — Schema design
- `pwa-offline-sync` — Offline sync strategy
- `secure-invite-and-access` — Auth flows
- `epub-rendering-and-cfi` — EPUB.js + CFI anchoring
- `reader-ui-ux` — Reader/admin UI patterns
- `testdata-builders` — Test fixtures
- `code-quality`, `code-review-assistant`, `security-code-auditor` — Quality checks
- `task-decomposition`, `parallel-execution` — Coordination
- `learn`, `memory-context` — Knowledge capture
- `anti-ai-slop`, `agent-browser`, `dogfood` — UX + testing
- `skill-creator`, `skill-evaluator` — Skill development
- `shell-script-quality` — Shell best practices

Run `./scripts/validate-skills.sh` to verify skill integrity.

---

# 18. GOAP implementation plan

## Goal

Build a secure offline-capable EPUB reading and editorial review platform.

## Initial world state

- no scaffold
- no schema
- no access flow
- no reader
- no admin UI

## Target world state

- deployable PWA
- secure grants and sessions
- private/public book modes
- offline reading
- comments/highlights
- tests and docs

## Ordered phases

### Phase 0. Foundation

- create monorepo
- add AGENTS.md
- add plans and ADRs
- configure pnpm/turbo
- configure lint/typecheck/test/build
- add CI

### Phase 1. Domain and schema

- define enums and DTOs
- create migrations
- add test fixtures/builders
- implement repository interfaces

### Phase 2. Access backend

- access request endpoint
- password validation
- session issuance
- signed R2 URLs
- audit logging

### Phase 3. Reader MVP

- reader shell
- EPUB.js integration
- TOC
- progress save/restore
- theme and typography controls

### Phase 4. Offline support

- service worker
- cache strategy
- IndexedDB persistence
- sync queue

### Phase 5. Editorial features

- highlights
- anchors
- comments
- replies
- resolve state

### Phase 6. Admin UI

- books list
- upload flow
- grant editor
- revoke access
- audit screen

### Phase 7. Hardening

- accessibility
- security
- performance
- regression coverage
- release readiness

---

# 19. ADRs to create in `plans/`

Create these first:

- `000-product-overview.md`
- `001-goap-roadmap.md`
- `002-adr-monorepo-stack.md`
- `003-adr-storage-model.md`
- `004-adr-auth-and-access.md`
- `005-adr-offline-sync.md`
- `006-adr-annotation-model.md`
- `007-implementation-phases.md`

## ADR topics

### `002-adr-monorepo-stack.md`

Decide:

- pnpm + turbo
- TypeScript
- Vite web app
- Worker backend
- shared packages

### `003-adr-storage-model.md`

Decide:

- R2 for EPUB files
- Turso for metadata/state
- IndexedDB + Cache Storage locally

### `004-adr-auth-and-access.md`

Decide:

- email + optional password grants
- short-lived sessions
- short-lived signed URLs
- audit trail

### `005-adr-offline-sync.md`

Decide:

- local-first writes
- queued sync
- idempotent mutations
- conflict strategies by entity type

### `006-adr-annotation-model.md`

Decide:

- CFI anchors
- selected text snapshot
- chapter reference
- fallback re-anchoring strategy

---

# 20. Frontend design rules

## Layout behavior

### Mobile

- top bar
- full-width reading area
- TOC as slide-over drawer
- comments as bottom sheet or tab

### Tablet

- optional split view
- TOC on left
- reader center
- comments side panel on demand

### Desktop

- TOC left
- reader center
- comments/highlights right
- collapsible sidebars

## Reader controls

- font size
- font family
- line height
- page width
- light/dark/sepia/system themes
- resume position
- chapter navigation
- search
- bookmark current position

## Accessibility rules

- keyboard navigation
- visible focus states
- semantic landmarks
- reduced motion support
- touch target minimum size
- screen reader labels

---

# 21. Backend security rules

## Access rules

- never reveal whether a specific email exists
- return generic access-denied responses
- rate limit access attempts
- hash passwords with a strong KDF
- expire sessions
- revoke sessions on permission revocation

## Storage rules

- private books use signed R2 URLs only
- signed URLs are short-lived
- do not expose raw storage paths in UI
- validate MIME type and extension
- optionally store checksum

## Content safety

- sanitize EPUB HTML before rendering
- strip unsafe scripts
- block remote script execution
- control iframe usage strictly

## Auditability

Log:

- grant created
- grant updated
- grant revoked
- access granted or denied
- comment moderation actions
- visibility changes

---

# 22. Offline architecture

## Cache Storage

Use for:

- app shell
- static assets
- cached EPUB assets
- cover images

## IndexedDB

Use for:

- progress
- bookmarks
- highlights
- pending comments
- sync queue
- reader preferences

## Sync rules

### Client

- write locally first
- enqueue sync job
- optimistic UI update

### Server

- idempotent mutation IDs
- last-write-wins for progress/preferences
- append-only semantics for comments/audit
- explicit merge rules for editable entities

## Caveat

A private book should not promise full offline availability until it has been opened online once and cached successfully.

---

# 23. Testing strategy

## Unit tests

Cover:

- permission evaluation
- password validation
- session creation
- locator serialization
- progress merging
- annotation reducers

## Integration tests

Cover:

- Worker routes with test DB
- signed URL issuance
- grant revocation
- sync queue replay

## Playwright E2E

Cover:

- admin creates book
- admin grants access
- reader authenticates
- reader opens book
- reader resumes position
- reviewer adds comment
- offline reading works
- reconnect sync works

## Regression focus

- invalid access does not leak user existence
- revoked users lose fresh file access
- offline queue does not duplicate comments
- malformed EPUB content does not execute scripts

---

# 24. Package boundaries

## `packages/schema`

Contains:

- SQL migrations
- DB-adjacent types
- schema constants

## `packages/shared`

Contains:

- shared DTOs
- validation helpers
- enums
- error classes

## `packages/reader-core`

Contains:

- EPUB abstractions
- locator mapping
- selection anchors
- preference logic

## `packages/ui`

Contains:

- reusable UI components
- layout primitives
- forms
- modals
- panels

## `apps/web`

Contains:

- routes
- reader UI
- admin UI
- local persistence
- sync orchestration

## `apps/worker`

Contains:

- API routes
- session/auth logic
- Turso access
- R2 signing
- audit logging

---

# 25. Recommended package scripts

Example root `package.json` script section:

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "playwright test",
    "test:e2e:smoke": "playwright test --grep @smoke",
    "verify:fast": "pnpm lint && pnpm typecheck && pnpm --filter @do-epub-studio/web test:unit -- src/features/reader/components/annotations src/features/admin",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "db:migrate:local": "node scripts/db-migrate-local.mjs",
    "db:migrate:prod": "node scripts/db-migrate-prod.mjs",
    "db:check": "node scripts/db-check.mjs"
  }
}
```

---

# 26. CI requirements

GitHub Actions should run:

- install
- lint
- typecheck
- unit/integration tests
- build
- optionally Playwright on preview or gated branch

## Quality gate

No feature is done unless:

- lint passes
- typecheck passes
- tests pass
- build passes

---

# 27. First vertical slice

This is the best first implementation slice.

## Deliverables

- monorepo scaffold
- root AGENTS.md
- plans + ADRs
- initial schema:
  - `books`
  - `book_files`
  - `book_access_grants`
  - `reader_sessions`
  - `reading_progress`

- admin create-book screen
- admin grant-access form
- EPUB upload to R2
- access request route
- session issuance
- signed file URL route
- reader shell with EPUB load
- save/restore progress

## Acceptance criteria

- admin can create one private book
- admin can grant one email access
- reader can authenticate
- reader can open EPUB
- reader progress persists
- revoked grant blocks fresh access
- lint passes
- typecheck passes
- tests pass
- build passes

---

# 28. AI-agent execution model

Use a disciplined orchestrated approach.

## Orchestrator

Responsibilities:

- read AGENTS.md
- read `plans/`
- choose next GOAP action
- assign subtasks
- verify completion gates

## Specialist agents

### Architecture agent

- validates ADRs
- checks module boundaries
- prevents coupling drift

### Backend agent

- Worker routes
- Turso repositories
- auth/session logic
- R2 signed URLs

### Frontend agent

- reader UI
- admin UI
- Zustand stores
- responsive UX

### EPUB agent

- EPUB.js integration
- CFI anchors
- TOC and locator logic

### Offline agent

- service worker
- IndexedDB
- cache strategy
- sync queue

### Test agent

- Vitest
- Playwright
- test builders
- regression coverage

### Security reviewer

- auth leak checks
- sanitization checks
- token expiry checks
- audit logging checks

## Agent rules

- no code before reading plans
- no source file over 500 LOC
- no merge without verify gate
- no docs update before successful implementation verification

---

# 29. Product naming inside the UI

## Reader modes

- `Read`
- `Review`
- `Public`

## Admin labels

- `Private access`
- `Password required`
- `Comments enabled`
- `Offline reading allowed`
- `Access expires`

## English wording for “Lektorat”

Best UI wording:

- `Editorial review`
- `Review comments`
- `Proofing access`

German locale later:

- `Lektorat`
- `Kommentare`
- `Offline lesen`
- `Zugriff`

---

# 30. Risks and mitigations

## EPUB anchor drift

Mitigation:

- CFI + selected text + chapter reference fallback

## Offline conflict drift

Mitigation:

- entity-specific merge rules
- append-only comments
- idempotent sync mutations

## Grant leakage

Mitigation:

- generic auth errors
- short-lived sessions
- short-lived signed URLs
- audit logs

## Overcomplicated auth too early

Mitigation:

- start with email + optional password
- avoid full account system in MVP

## Public/private storage mistakes

Mitigation:

- all file access goes through Worker gate
- never expose raw storage paths as the source of truth

---

# 31. Definition of done

A change is done only if:

- plan impact checked
- implementation complete
- no source file exceeds 500 LOC
- lint passes
- typecheck passes
- tests pass
- build passes
- generated artifacts (e.g., `playwright-report/`, `test-results/`, `verification_output.txt`) are NOT committed
- security implications reviewed
- docs updated if behavior changed

---

# 32. Final recommendation

Start `do-epub-studio` as:

- private GitHub repo
- pnpm + turbo monorepo
- `apps/web`, `apps/worker`, `packages/*`
- Cloudflare Workers + R2 + Turso
- `wrangler.jsonc` for Worker config
- Wrangler secrets for sensitive Worker values
- `.dev.vars` for local Worker dev
- `.env.local` only for browser-safe frontend values
- Turso CLI for DB provisioning and token generation
- EPUB.js for MVP
- IndexedDB + Cache Storage for offline
- AGENTS.md + plans/ for AI-agent execution

## Best first milestone

One private EPUB, one approved reader grant, one successful authenticated reading session, and one offline-capable resume flow.

If you want the next step, turn this guide into repo files (`README.md`, `AGENTS.md`, `wrangler.jsonc`, example config files, plans, ADRs, CI, schema/API skeleton). This guide is now the canonical reference.

---

# 13. Agent coding workflow (2026 operational checklist)

Use this checklist when handling cross-cutting requests (optimization + new features + docs + test strategy):

1. **Load prior context first**
   - Read `agents-docs/LEARNINGS.md` before implementation.
2. **Update plan artifacts before code changes**
   - Add/adjust entries in `plans/007-implementation-phases.md` and relevant backlog plan.
3. **Prefer deterministic test defaults**
   - Vitest should run in non-watch mode for CI (`vitest --run`).
   - Playwright should keep trace/video/screenshot artifacts on failure.
4. **Separate PR checks from nightly depth**
   - PR: lint + typecheck + unit tests + smoke E2E.
   - Nightly: full cross-browser E2E + benchmarks + budget/perf checks.
5. **Track missing tasks explicitly**
   - Do not leave “known gaps” only in PR text; store them in `plans/` with owner/acceptance criteria.
6. **Close verification loop**
   - Run `./scripts/quality_gate.sh` and keep the output green before commit.
7. **Capture non-obvious learnings**
   - Append durable discoveries (not session noise) to `agents-docs/LEARNINGS.md`.
