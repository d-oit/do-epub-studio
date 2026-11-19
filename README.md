# d.o.EPUB Studio

[![CI](https://github.com/d-oit/do-epub-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/d-oit/do-epub-studio/actions/workflows/ci.yml)
[![CodeQL](https://github.com/d-oit/do-epub-studio/actions/workflows/codeql.yml/badge.svg)](https://github.com/d-oit/do-epub-studio/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/d-oit/do-epub-studio?include_prereleases)](https://github.com/d-oit/do-epub-studio/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A platform for creating, managing, and reading EPUB files. Requires Cloudflare account provisioning for production deployment.

## Architecture

```
do-epub-studio/
├── apps/
│   ├── web/          # React 19 SPA (Vite 8, Tailwind 4, Zustand 5)
│   ├── worker/       # Cloudflare Worker API (Hono, D1, R2)
│   └── tests/        # Cross-app E2E tests (Playwright)
├── packages/
│   ├── schema/       # Shared Zod schemas (validation contracts)
│   ├── shared/       # Shared DTOs, types, utilities
│   ├── ui/           # Design system components (Button, Modal, Tooltip, …)
│   ├── testkit/      # Deterministic test fixtures & builders
│   └── reader-core/  # EPUB parsing engine (epubjs)
└── scripts/          # Quality gates, migrations, CI helpers
```

## Core Stack

- **Frontend**: React 19 + Vite 8 + Tailwind 4 + Zustand 5
- **Backend**: Cloudflare Workers + D1 (production; local dev uses Wrangler's local D1 emulation) + R2
- **Language**: TypeScript 6 (Strict Mode)
- **Testing**: Vitest 4 + Playwright 1.59+ (Chromium + WebKit in PR smoke CI)
- **Tooling**: Turborepo 2.9 + pnpm 10

## Key Features

- **Agentic Native**: Repository structure and docs optimized for AI coding agents.
- **Security First**: Argon2id password hashing, DOMPurify sanitization, bearer-token auth with session revocation, signed URL file access, CSP headers, and login rate limiting (5 attempts / 15 min lockout).
- **Offline Capable**: PWA with IndexedDB sync queue, Background Sync API, and conflict detection.
- **Privacy Focused**: Granular access grants and auditable trails.
- **Annotation Export**: Reader notes (highlights, comments, bookmarks) as Markdown, HTML, or a bounded EPUB re-export that appends one XHTML annotation appendix to the current revision and is returned only after synchronous EPUBCheck accepts the exact bytes.
- **Native Authoring**: Book-scoped authoring grants, version-locked manuscript drafts, metadata and bounded local assets, deterministic immutable EPUB 3 publishing, and a preview rendered by the production reader.

## Quick Start

### Prerequisites

- Node.js v22+ LTS
- pnpm 10+
- Git
- Wrangler (installed as a devDependency; no global install needed)

### Setup

```bash
git clone <repo-url> do-epub-studio
cd do-epub-studio
cp apps/worker/.dev.vars.example apps/worker/.dev.vars  # fill in secrets
cp apps/web/.env.local.example apps/web/.env.local      # fill in values
pnpm install
./scripts/health-check.sh   # verify environment
pnpm db:migrate:local       # initialize local D1 database
pnpm dev                    # starts worker + web dev servers
# Worker: http://localhost:8787
# Web: http://localhost:5173
```

See [docs/setup-local.md](docs/setup-local.md) for detailed development environment setup.

## Commands

| Command                     | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                  | Start all dev servers                                         |
| `pnpm build`                | Production build                                              |
| `pnpm lint`                 | Lint all packages + workflow validation                       |
| `pnpm typecheck`            | Type-check all packages                                       |
| `pnpm test`                 | Run all unit tests                                            |
| `pnpm test:coverage`        | Run tests with coverage                                       |
| `pnpm test:e2e:smoke`       | Run E2E smoke suite (`@smoke`; CI: chromium + webkit + pixel) |
| `./scripts/quality_gate.sh` | Full quality gate (see Quality Gates)                         |
| `./scripts/health-check.sh` | Verify dev environment                                        |

Playwright defines `chromium`, `firefox`, `iphone`, `pixel` and `pwa-chromium`
projects; `webkit` is registered only when `PLAYWRIGHT_INCLUDE_WEBKIT=1`, which
CI sets for its smoke lane.

## Quality Gates

Every commit must pass `./scripts/quality_gate.sh` (exit 0). It runs, in order:

1. Project rails: pinned `do-harness` version, git-hook config, workflow lint (actionlint + zizmor), skill symlinks, agent-adapter sync, app identity/version governance
2. Documentation rails: ADR index, plan references, 500-line source cap, Prettier `format:check`, coverage parity, gate-parity manifest, SKILL.md format/links/catalog
3. Code rails: ESLint (zero warnings), TypeScript strict, Vitest with coverage thresholds, Playwright E2E smoke, production build
4. Quality rails: markdownlint, impeccable design detector, dead-code and circular-dependency check

`SKIP_*` variables exist for local iteration and make the gate exit 3, which
`atomic-commit` rejects. Codacy and bundle-budget enforcement are additional CI
required checks.

## Documentation

- [Coding Guide](docs/coding-guide.md): Architectural patterns and conventions.
- [Agent Config](AGENTS.md): Instructions and guardrails for AI agents.
- [Agent Workflow](agents-docs/WORKFLOW.md): Step-by-step verification, commit, and mandatory post-task learning flow.
- [Project Learnings](agents-docs/LEARNINGS.md): Aggregated non-obvious discoveries from past work.
- [Security](docs/security.md): Security model, session tokens, signed URLs, CSP.
- [Security Posture](docs/security-posture.md): Standing decisions (auth, CSP, token storage).
- [Observability](docs/observability-telemetry.md): Client telemetry contract and tracing.
- [Performance Budgets](docs/performance-budgets.md): Bundle budget model and baseline regeneration.

## License

[MIT](LICENSE)
