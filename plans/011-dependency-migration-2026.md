# Managed Dependency Upgrade Strategy (2026 Stack)

## Status
- **Proposed:** April 2026
- **Status:** Active
- **Related Issues:** Supports #NN 2026 Stack Migration

## Problem Statement
The repository is migrating to the 2026 stack (TS6, Vite8, TW4). Coordinated upgrades are essential to prevent CI failures and ensure ecosystem compatibility between coupled tools like Vite, Vitest, and ESLint.

## 2026 Toolchain Baseline

| Component | Target Version | Status |
|-----------|----------------|--------|
| TypeScript | 6.0.2+ | Migrated |
| Vite | 8.0.8+ | Migrated |
| Vitest | 4.1.4+ | Migrated |
| Tailwind CSS | 4.2.2+ | Migrated |
| Playwright | 1.59.1+ | Migrated |
| ESLint | 9.0.0+ | Migrated |
| Node.js | 22.x (LTS) | Current |
| pnpm | 10.33.0+ | Current |

## Upgrade Batches

To reduce churn and ensure stability, upgrades are grouped by compatibility domain.

### 1. Build Chain
- **Scope:** `typescript`, `vite`, `vite-plugin-pwa`, `rollup`, `esbuild`, `@tailwindcss/vite`.
- **Strategy:** Major upgrades must be validated together. PWA behavior and Rolldown compatibility are high-risk.

### 2. Test Chain
- **Scope:** `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `@testing-library/*`, `jsdom`, `fake-indexeddb`.
- **Strategy:** Focus on test isolation (pool: forks) and browser binary alignment.

### 3. Lint/Config Chain
- **Scope:** `eslint`, `prettier`, `typescript-eslint`, `eslint-plugin-*`, `globals`.
- **Strategy:** Align with ESLint flat config (v9+) and TS6 syntax support.

### 4. Runtime & Utilities
- **Scope:** `react`, `react-dom`, `zustand`, `framer-motion`, `zod`, `uuid`, `epubjs`.
- **Strategy:** Focus on React 18/19 concurrency compatibility and animation stability.

## Automerge Policy

- **Patch/Minor Updates:** Automerge enabled if CI (Quality Gate) passes.
- **Major Updates:** Manual review required. Must be linked to this migration plan.
- **Security Updates:** Accelerated review/merge regardless of version type.

## Compatibility Checklist

Before merging any major dependency upgrade, the following must be verified:

- [ ] **Build:** `pnpm build` succeeds for all apps and packages.
- [ ] **Typecheck:** `pnpm typecheck` returns zero errors.
- [ ] **Unit Tests:** `pnpm test` (Vitest) passes with isolation (pool: forks).
- [ ] **E2E Tests:** `pnpm test:e2e` (Playwright) passes in all target browsers.
- [ ] **PWA:** Service worker generates correctly and offline mode functions.
- [ ] **Worker:** `apps/worker` starts and responds to health checks.
- [ ] **Audit:** `pnpm audit` shows zero high/critical vulnerabilities.

## Linkage
All PRs performing major version bumps for the 2026 stack must include:
`Part of Managed Dependency Upgrade Strategy (plans/011-dependency-migration-2026.md)`
