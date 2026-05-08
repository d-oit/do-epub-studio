# d.o. EPUB Studio (2026 Edition)

A production-grade, agent-optimized platform for creating, managing, and reading EPUB files.

## Core Stack
- **Frontend**: React 19 + Vite 8 + Tailwind 4 + Zustand 5
- **Backend**: Cloudflare Workers + D1/Turso + R2
- **Language**: TypeScript 6 (Strict Mode)
- **Testing**: Vitest 4 + Playwright 1.59+
- **Tooling**: Turborepo 2.9 + pnpm 10

## Key Features
- **Agentic Native**: Repository structure and docs optimized for AI coding agents.
- **Security First**: Mandatory Argon2id, DOMPurify sanitization, and signed URL isolation.
- **Offline Capable**: PWA with advanced IndexedDB sync and Workbox 7.
- **Privacy Focused**: Granular access grants and encrypted audit trails.

## Quick Start
1. `pnpm install`
2. `./scripts/health-check.sh`
3. `pnpm dev`

See [docs/setup-local.md](docs/setup-local.md) for detailed development environment setup.

## Documentation
- [Coding Guide](docs/coding-guide.md): Architectural patterns and conventions.
- [Agent Config](AGENTS.md): Instructions and guardrails for AI agents.
- [Security](docs/security.md): Security model and hardening (Coming Soon).

## License
[MIT](LICENSE)
