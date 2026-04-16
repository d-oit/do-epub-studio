# Quality Backlog
- [x] Resolve React 18 / Vitest concurrency issues (switched to forks)
- [x] Implement edge-case E2E tests (network errors, 401s)
- [x] Centralize API trace-id propagation
- [ ] Lighthouse CI performance tuning (Fixing NO_FCP in CI)
- [ ] Move shared UI components to @do-epub-studio/ui

## Resolved Infrastructure Updates (April 2026)

- [x] **TypeScript 7.0 Preparation**: Fixed `baseUrl` deprecations in `tsconfig.base.json`.
- [x] **Vite 8 Migration**: Refactored `apps/web/vite.config.ts` for Rolldown compatibility.
- [x] **Vitest 4 Fix**: Resolved the `offline-sync.test.ts` regression.
- [x] **Tailwind 4 Engine**: Refactored `apps/web/src/styles/globals.css` for the Tailwind 4 engine and integrated via Vite plugin.
- [x] **Accessibility Hardening**: Applied `useId` and `aria-busy` patterns to `packages/ui` and local components.
