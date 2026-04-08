# ADR-002: Monorepo Stack

**Status:** Accepted  
**Date:** 2026-04-07

## Context

We need to choose the development and deployment stack for `do EPUB Studio` that supports:
- TypeScript everywhere
- Fast iteration cycles
- Offline-capable PWA
- Cloudflare Workers backend
- Shared code between frontend and backend

## Decision

We will use a pnpm + Turbo monorepo with these packages:

```
do-epub-studio/
├── apps/
│   ├── web/           # Vite + PWA frontend
│   └── worker/        # Cloudflare Workers backend
├── packages/
│   ├── schema/        # SQL migrations, DB types
│   ├── shared/        # DTOs, validation, enums
│   ├── ui/            # Reusable UI components
│   ├── reader-core/   # EPUB abstractions, CFI, locators
│   └── testkit/       # Test data builders
└── scripts/          # DevOps scripts
```

## Stack Components

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Package manager | pnpm + workspaces | Fast, strict, monorepo-native |
| Build system | Turbo | Caching, parallel builds |
| Frontend | TypeScript + Vite + PWA | Fast dev, offline support |
| Backend | Cloudflare Workers | Edge runtime, R2/Turso bindings |
| Database | Turso (libsql) | Syncable SQLite, edge-compatible |
| Object storage | Cloudflare R2 | EPUB file storage |
| Styling | Tailwind CSS | Utility-first, responsive |
| State | Zustand | Lightweight, TypeScript-native |
| Validation | Zod | Runtime validation at boundaries |
| Testing | Vitest + Playwright | Unit/integration + E2E |

## Consequences

**Positive:**
- Shared types between frontend/backend via `packages/shared`
- Independent deploys for web and worker
- Turbo caching speeds up CI
- Clear package boundaries enforce architecture

**Negative:**
- More complex setup than single-package repo
- pnpm workspace conflicts possible with some packages

## References

- TRIZ Analysis: `analysis/triz-core-2026-04-07.md`
- TRIZ Resolution: `plans/002-triz-resolution.md`
- Contradiction #3 resolved via Segmentation principle
