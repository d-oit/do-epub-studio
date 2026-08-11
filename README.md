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
│   └── reader-core/  # EPUB parsing engine (epubjs)
└── scripts/          # Quality gates, migrations, CI helpers
```

## Core Stack
- **Frontend**: React 19 + Vite 8 + Tailwind 4 + Zustand 5
- **Backend**: Cloudflare Workers + D1 (production; local dev uses a libSQL/Turso-compatible runtime via `apps/worker/wrangler.jsonc`) + R2
- **Language**: TypeScript 6 (Strict Mode)
- **Testing**: Vitest 4 + Playwright 1.59+ (Chromium + WebKit in PR smoke CI)
- **Tooling**: Turborepo 2.9 + pnpm 10

## Key Features
- **Agentic Native**: Repository structure and docs optimized for AI coding agents.
- **Security First**: Argon2id password hashing, DOMPurify sanitization, bearer-token auth with session revocation, signed URL file access, CSP headers, and login rate limiting (5 attempts / 15 min lockout).
- **Offline Capable**: PWA with IndexedDB sync queue, Background Sync API, and conflict detection.
- **Privacy Focused**: Granular access grants and auditable trails.

## Quick Start

### Prerequisites
- Node.js v22+ LTS
- pnpm 10+
- Git
- Wrangler CLI (`npm install -g wrangler@latest`)
- Turso CLI (optional, for local DB management)

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

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Production build |
| `pnpm lint` | Lint all packages + workflow validation |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all unit tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:e2e:smoke` | Run E2E smoke suite (Chromium + WebKit) |
| `./scripts/quality_gate.sh` | Full quality gate (lint + typecheck + test + design) |
| `./scripts/health-check.sh` | Verify dev environment |

## Quality Gates

Every commit must pass:
1. ESLint (all packages via `turbo run lint`)
2. TypeScript strict mode (`turbo run typecheck`)
3. Vitest unit tests with coverage thresholds
4. Playwright E2E smoke tests
5. Codacy static analysis (CI required check)
6. Bundle budget enforcement

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
