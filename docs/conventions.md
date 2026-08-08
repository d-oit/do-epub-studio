# Coding Conventions

Authoritative coding conventions, naming, file organisation, TypeScript patterns,
testing strategy, frontend design rules, and agent workflow for `do-epub-studio`.

---

## TypeScript & language rules

- TypeScript everywhere by default. No plain JS source files.
- `strict: true` (inherited from `tsconfig.base.json`).
- `no any` unless justified and isolated — see [`docs/banned-patterns.md`](./banned-patterns.md).
- Zod for all boundary validation (API request/response, env vars, form input).
- Zustand for client state.
- Prefer pure functions for domain logic.
- Keep service interfaces small and explicit.
- Use dependency injection where it simplifies testing.

## File organisation

- Max **500 LOC per source file** (enforced via lint).
- Feature code lives in `apps/web/src/features/<feature>/`.
- Shared utilities live in `packages/shared/src/`.
- EPUB abstractions live in `packages/reader-core/src/`.
- UI primitives live in `packages/ui/src/`.

## Naming

| Kind | Convention | Example |
|------|-----------|---------|
| React components | PascalCase | `ReaderPage` |
| Hooks | `use` prefix, camelCase | `useBookProgress` |
| Stores (Zustand) | camelCase + `Store` suffix | `readerStore` |
| Zod schemas | camelCase + `Schema` suffix | `accessRequestSchema` |
| Types/interfaces | PascalCase | `BookMetadata` |
| Enum values | SCREAMING_SNAKE | `ACCESS_MODE.PRIVATE` |
| DB column names | snake_case | `session_token_hash` |
| Route handlers | verb-noun pattern | `handleGetBook` |

---

## Frontend design rules

### Layout behaviour

**Mobile:**
- top bar
- full-width reading area
- TOC as slide-over drawer
- comments as bottom sheet or tab

**Tablet:**
- optional split view; TOC left, reader centre, comments side panel on demand

**Desktop:**
- TOC left, reader centre, comments/highlights right, collapsible sidebars

### Reader controls

- font size, font family, line height, page width
- light/dark/sepia/system themes
- resume position, chapter navigation, search, bookmark current position

### Accessibility

- keyboard navigation, visible focus states, semantic landmarks
- reduced motion support, touch target minimum size, screen reader labels
- WCAG 2.1 AA minimum; use semantic design tokens (`text-foreground`, `bg-background`, etc.) from `globals.css`
- Enable View Transitions for all page-to-page navigations
- Enforce mutual exclusivity for reader side-panels (TOC, Settings, etc.)

### UI copy

| Reader modes | `Read`, `Review`, `Public` |
|---|---|
| Admin labels | `Private access`, `Password required`, `Comments enabled`, `Offline reading allowed`, `Access expires` |
| Editorial labels | `Editorial review`, `Review comments`, `Proofing access` |

German locale keys (later): `Lektorat`, `Kommentare`, `Offline lesen`, `Zugriff`.

### Styling

- Tailwind CSS 4.x utility classes
- OKLCH for colour tokens (perceptually uniform, P3-wide-gamut support)
- Design tokens defined in `apps/web/src/styles/globals.css`

---

## Testing strategy

### Unit tests (Vitest)

Cover:
- permission evaluation
- password validation
- session creation
- locator serialisation
- progress merging
- annotation reducers

### Integration tests

Cover:
- Worker routes with test DB
- signed URL issuance
- grant revocation
- sync queue replay

### Playwright E2E

Cover:
- admin creates book and grants access
- reader authenticates and opens book
- reader resumes position
- reviewer adds comment
- offline reading works; reconnect sync works

### Regression focus

- invalid access does not leak user existence
- revoked users lose fresh file access
- offline queue does not duplicate comments
- malformed EPUB content does not execute scripts

### Test infrastructure

- `pool: 'forks'` for Vitest test isolation
- `vitest --run` (non-watch) in CI
- Playwright keeps trace/video/screenshot artefacts on failure
- Use test data builders from `packages/testkit/src/` for grants, books, comments, sessions
- Coverage thresholds (enforced by `test:coverage`):
  - `web`: 55% Lines / 48% Functions
  - `worker`: 55% Lines / 50% Functions
  - `shared`: 40% Lines / 50% Functions
  - `reader-core`: 72% Lines / 70% Functions

---

## Package scripts

Root `package.json`:

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

## CI requirements

GitHub Actions runs: install → lint → typecheck → unit/integration tests → build.
Playwright runs on preview or gated branch.

**Quality gate (blocking):** lint passes, typecheck passes, tests pass, build passes.

See also: `AGENTS.md` Tier 2 for full gate details and coverage thresholds.

---

## Definition of done

A change is done only when:

1. Plan impact checked; ADR updated if needed
2. Implementation complete; no source file exceeds 500 LOC
3. Lint passes (`turbo run lint`)
4. Typecheck passes
5. Tests pass; coverage thresholds met
6. Build passes
7. Generated artefacts (`playwright-report/`, `test-results/`, `verification_output.txt`) NOT committed
8. Security implications reviewed
9. Docs updated if behaviour changed
10. `./scripts/quality_gate.sh` green

---

## AI-agent execution model

### Orchestrator responsibilities

- read `AGENTS.md` and `plans/`
- choose next GOAP action; assign subtasks; verify completion gates

### Specialist agents

| Agent | Scope |
|---|---|
| Architecture | validates ADRs, checks module boundaries, prevents coupling drift |
| Backend | Worker routes, Turso repositories, auth/session, R2 signed URLs |
| Frontend | reader UI, admin UI, Zustand stores, responsive UX |
| EPUB | EPUB.js integration, CFI anchors, TOC and locator logic |
| Offline | service worker, IndexedDB, cache strategy, sync queue |
| Test | Vitest, Playwright, test builders, regression coverage |
| Security reviewer | auth leak checks, sanitisation, token expiry, audit logging |

### Agent rules

- no code before reading plans
- no source file over 500 LOC
- no merge without verify gate
- no docs update before successful implementation verification

### Agent coding workflow checklist

Use when handling cross-cutting requests:

1. **Load prior context first** — Read `agents-docs/LEARNINGS.md` before implementation.
2. **Update plan artefacts before code changes** — adjust `plans/007-implementation-phases.md` and relevant backlog plan.
3. **Prefer deterministic test defaults** — `vitest --run` for CI; Playwright keeps artefacts on failure.
4. **Separate PR checks from nightly depth** — PR: lint + typecheck + unit tests + smoke E2E; Nightly: full cross-browser E2E + benchmarks + perf checks.
5. **Track missing tasks explicitly** — store gaps in `plans/` with owner and acceptance criteria.
6. **Close verification loop** — run `./scripts/quality_gate.sh` and keep output green before commit.
7. **Capture non-obvious learnings** — append durable discoveries to `agents-docs/LEARNINGS.md`.
