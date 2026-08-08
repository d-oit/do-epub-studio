# Onboarding — d.o.EPUB Studio

`d.o.EPUB Studio` is a web-based EPUB reading and editorial workspace for
self-publishing, controlled distribution, and annotated review. It is built as a
TypeScript monorepo targeting Cloudflare Pages + Workers with offline-capable PWA support.

---

## Quick start

Set up your local environment by following **[`docs/setup-local.md`](./setup-local.md)**.

---

## Entry-point chain

Read these files in order before making any changes:

| File | What it contains |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Claude-specific adapter: project summary, security invariants, skill invocation rules |
| [`AGENTS.md`](../AGENTS.md) | Single source of truth for AI agents: Tier 1 critical rules, quality gates, compliance self-check |
| [`llms.txt`](../llms.txt) / [`llms-full.txt`](../llms-full.txt) | Machine-readable project summary for LLM context windows |
| [`docs/coding-guide.md`](./coding-guide.md) | Authoritative architecture, configuration, and user-flow reference with links to split files |
| [`plans/ADR-INDEX.md`](../plans/ADR-INDEX.md) | Index of all Architecture Decision Records; start here for "why" questions |

---

## Key architecture

- **TypeScript 6 strict** everywhere — `tsconfig.base.json` enforces `strict: true`
- **React 19 + Vite 8** frontend (`apps/web`) hosted on Cloudflare Pages
- **Hono on Cloudflare Workers** API backend (`apps/worker`) with Turso/libSQL + R2
- **Zustand 5** for client state; Zod 4 for boundary validation
- **Vitest 4** (unit + integration) + **Playwright 1.60** (E2E); pnpm + Turborepo monorepo

---

## Security invariants

These rules are non-negotiable. Do not weaken them.

1. Reader iframe `sandbox` attribute **MUST** be `['allow-same-origin']` — no `allow-scripts`.
2. Worker Content-Security-Policy sandbox **MUST** be `allow-same-origin`.
3. All EPUB content **MUST** go through `sanitizeEpubDocument` (allowlist-based, not forbid-only).
4. Password hashing: **Argon2id only** — bcrypt and scrypt are banned.
5. Regexes against untrusted input: **use `matchBounded` / `testBounded`** from `@do-epub-studio/shared`.

Full details: [`docs/security.md`](./security.md), [`docs/banned-patterns.md`](./banned-patterns.md), [`docs/security-posture.md`](./security-posture.md).

---

## Where to go next

- **Start working:** follow the `AGENTS.md` **Tier 1 checklist** before touching any file.
- **Plan a multi-step task:** invoke the `goap-agent` skill — required for all analysis, planning, and cross-cutting work.
- **Understand the architecture:** [`docs/architecture.md`](./architecture.md)
- **Configuration and secrets:** [`docs/coding-guide.md#configuration`](./coding-guide.md#9-configuration-and-secrets-model)
- **Coding conventions, naming, testing:** [`docs/conventions.md`](./conventions.md)
- **Banned patterns:** [`docs/banned-patterns.md`](./banned-patterns.md)
- **Offline sync design:** [`docs/offline.md`](./offline.md)
- **API reference:** [`docs/api.md`](./api.md)
