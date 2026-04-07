# 002: ADR - Monorepo Stack

## Decision
Use a pnpm + turbo monorepo with TypeScript, Vite, and Cloudflare Workers.

## Rationale
- **pnpm + turbo**: Efficient dependency management and task orchestration.
- **TypeScript**: Strong typing for maintainability.
- **Vite**: Fast, modern frontend tooling.
- **Cloudflare Workers**: Edge runtime for the backend.
- **Zustand**: Lightweight client state management.
- **Vitest + Playwright**: Comprehensive testing.
- **Tailwind**: Utility-first CSS for responsive UI.

## Consequences
- Clear module boundaries and shared packages.
- Consistent tooling across the stack.
