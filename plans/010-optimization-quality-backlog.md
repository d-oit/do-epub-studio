# Quality Backlog
- [x] Resolve React 18 / Vitest concurrency issues (switched to forks)
- [x] Implement edge-case E2E tests (network errors, 401s)
- [x] Centralize API trace-id propagation
- [x] **Package Security Updates** - Fix serialize-javascript and xmldom vulnerabilities
- [x] **Memory Leak Fixes** - Toast timeout cleanup, global error handler isolation
- [x] **Error Handling Improvements** - Create error utility, fix Promise.all issues
- [ ] Lighthouse CI performance tuning (Fixing NO_FCP in CI)
- [ ] Move shared UI components to @do-epub-studio/ui

## Security Updates (April 2026)

### Critical Security Fixes Required

- [ ] **vite-plugin-pwa** - Update to fix 6 serialize-javascript vulnerabilities (RCE + DoS)
- [ ] **epubjs** - Update to fix @xmldom/xmldom XML injection vulnerability
- [ ] **@lhci/cli** - Consider removing if unused (has tmp/uuid vulnerabilities)
- [ ] **Rate limiting** - Implement on auth endpoints in worker

### Security Improvements

- [x] **Argon2id password hashing** - Already implemented per AGENTS.md
- [x] **Zod validation** - All inputs validated
- [x] **SQL parameterization** - No injection risks
- [ ] **Test credentials** - Move to environment variables

## Error Handling & Logging (April 2026)

- [x] **TraceId Implementation** - Worker has full implementation
- [x] **Global error handlers** - Both web and worker have handlers
- [ ] **Consolidate telemetry.ts** - Remove duplicate in apps/web
- [ ] **Import shared traceId** - reader-core has local implementation
- [ ] **Add traceId to sync.ts** - Missing for sync failures
- [ ] **Add traceId to sw.ts** - Missing for service worker logs
- [ ] **Create error utility** - Standardize error type handling
- [ ] **Promise.all → Promise.allSettled** - Handle partial failures

## Memory Leak Fixes (April 2026)

### High Priority

- [ ] **Toast timeout cleanup** - `packages/ui/src/toast.tsx:27` - Track and clear timeouts
- [ ] **Global error handler isolation** - `apps/web/src/main.tsx:38` - Fix for testing/HMR

### Medium Priority

- [ ] **Sync retry timeout** - `apps/web/src/lib/offline/sync.ts:97` - Continue after unmount
- [ ] **IndexedDB explicit close** - `apps/web/src/lib/offline/db.ts` - Add close function

## Package Updates (April 2026)

### Immediate (Security)

- [ ] `vite-plugin-pwa`: ^1.2.0 → latest
- [ ] `epubjs`: ^0.3.93 → latest

### High Priority

- [ ] `eslint`: 9.39.4 → 10.2.1 (breaking change)
- [ ] `@eslint/js`: 9.39.4 → 10.0.1
- [ ] `eslint-plugin-security`: 3.0.1 → 4.0.0
- [ ] `globals`: 15.15.0 → 17.5.0

### Routine

- [ ] `typescript`: 6.0.2 → 6.0.3
- [ ] `vitest`: 4.1.4 → 4.1.5
- [ ] `prettier`: 3.8.1 → 3.8.3
- [ ] `typescript-eslint`: 8.58.1 → 8.59.1

## Resolved Infrastructure Updates (April 2026)

- [x] **TypeScript 7.0 Preparation**: Fixed `baseUrl` deprecations in `tsconfig.base.json`.
- [x] **Vite 8 Migration**: Refactored `apps/web/vite.config.ts` for Rolldown compatibility.
- [x] **Vitest 4 Fix**: Resolved the `offline-sync.test.ts` regression.
- [x] **Tailwind 4 Engine**: Refactored `apps/web/src/styles/globals.css` for the Tailwind 4 engine and integrated via Vite plugin.
- [x] **Accessibility Hardening**: Applied `useId` and `aria-busy` patterns to `packages/ui` and local components.
