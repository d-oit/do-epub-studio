# Quality Backlog

- [x] Resolve React 18 / Vitest concurrency issues (switched to forks)
- [x] Implement edge-case E2E tests (network errors, 401s)
- [x] Centralize API trace-id propagation
- [x] **Package Security Updates** - Fix serialize-javascript and xmldom vulnerabilities
- [x] **Memory Leak Fixes** - Toast timeout cleanup, global error handler isolation
- [x] **Error Handling Improvements** - Create error utility, fix Promise.all issues
- [ ] Lighthouse CI performance tuning (Fixing NO_FCP in CI) — tracked in #140 §7.3
- [ ] Move shared UI components to @do-epub-studio/ui — tracked in #140 §7.2

## epub-js Migration Follow-Up (May 2026)

Issue #128 closed; all follow-up work tracked in **[issue #140](https://github.com/d-oit/do-epub-studio/issues/140)**.

### Reader Engine Hardening
- [ ] Remove duplicate telemetry helpers from epub-loader.ts → import from shared (#140 §1.1)
- [ ] Expose `flow` and `manager` options in EpubLoader API (#140 §1.2)
- [ ] Type `getContents()` with Contents type; expose DOM access (#140 §1.3)
- [ ] Add `registerContentHook` / `registerRenderHook` to adapter (#140 §1.4)
- [ ] Add keyboard navigation in ReaderPage + E2E test (#140 §1.5)

## Security Updates (April–May 2026)

### Critical Security Fixes Required

- [ ] **vite-plugin-pwa** - Update to fix 6 serialize-javascript vulnerabilities (RCE + DoS) — #140 §2.4
- [ ] **@intity/epub-js** - Audit @xmldom/xmldom transitive dep for XML injection — #140 §2.4
- [ ] **@lhci/cli** - Consider removing if unused (has tmp/uuid vulnerabilities) — #140 §2.4
- [ ] **Rate limiting** - Replace in-memory rate limiter with Durable Objects / KV — #140 §2.2
- [ ] **Multi-signal locators** - Enforce in schema + worker validation — #140 §2.1
- [ ] **Session expiry** - Validate on all authenticated routes — #140 §2.3

### Security Improvements

- [x] **Argon2id password hashing** - Already implemented per AGENTS.md
- [x] **Zod validation** - All inputs validated
- [x] **SQL parameterization** - No injection risks
- [ ] **Test credentials** - Move to environment variables

## Error Handling & Logging (April 2026)

- [x] **TraceId Implementation** - Worker has full implementation
- [x] **Global error handlers** - Both web and worker have handlers
- [ ] **Consolidate telemetry.ts** - Remove duplicate in apps/web — #140 §4.3
- [ ] **Import shared traceId** - reader-core has local implementation — #140 §1.1
- [ ] **Add traceId to sync.ts** - Missing for sync failures — #140 §4.1
- [ ] **Add traceId to sw.ts** - Missing for service worker logs — #140 §4.1
- [ ] **Promise.all → Promise.allSettled** - Handle partial failures — #140 §4.4

## Memory Leak Fixes (April–May 2026)

### High Priority

- [ ] **Toast timeout cleanup** - `packages/ui/src/toast.tsx:27` - Track and clear timeouts — #140 §4.2
- [ ] **Global error handler isolation** - `apps/web/src/main.tsx:38` - Fix for testing/HMR — #140 §4.2

### Medium Priority

- [ ] **Sync retry timeout** - `apps/web/src/lib/offline/sync.ts:97` - Continue after unmount — #140 §4.2
- [ ] **IndexedDB explicit close** - `apps/web/src/lib/offline/db.ts` - Add close function — #140 §4.2

## Package Updates (April–May 2026)

### Immediate (Security)

- [ ] `vite-plugin-pwa`: ^1.2.0 → latest
- [ ] `@intity/epub-js`: audit @xmldom/xmldom transitive dep

### High Priority

- [ ] `eslint`: 9.39.4 → 10.x (breaking change — audit config) — #140 §7.1
- [ ] `@eslint/js`: 9.39.4 → 10.0.1
- [ ] `eslint-plugin-security`: 3.0.1 → 4.0.0
- [ ] `globals`: 15.15.0 → 17.5.0

### Routine

- [ ] `typescript`: 6.0.2 → 6.0.3 — #140 §7.1
- [ ] `vitest`: 4.1.4 → 4.1.5 — #140 §7.1
- [ ] `prettier`: 3.8.1 → 3.8.3 — #140 §7.1
- [ ] `typescript-eslint`: 8.58.1 → 8.59.1 — #140 §7.1

## Resolved Infrastructure Updates (April 2026)

- [x] **TypeScript 7.0 Preparation**: Fixed `baseUrl` deprecations in `tsconfig.base.json`.
- [x] **Vite 8 Migration**: Refactored `apps/web/vite.config.ts` for Rolldown compatibility.
- [x] **Vitest 4 Fix**: Resolved the `offline-sync.test.ts` regression.
- [x] **Tailwind 4 Engine**: Refactored `apps/web/src/styles/globals.css` for the Tailwind 4 engine and integrated via Vite plugin.
- [x] **Accessibility Hardening**: Applied `useId` and `aria-busy` patterns to `packages/ui` and local components.
- [x] **epub-js migration**: Migrated from `futurepress/epub.js` to `intity/epub-js` with adapter layer (#128).

## Feature Gap Closures (tracked in #140)

- [ ] Reader UI wired to backend (progress hydration, sync, offline restore, capability gates) — #140 §3.1
- [ ] Annotation restore on displayed event — #140 §3.2
- [ ] Admin UI: CreateBookModal + GrantManagement — #140 §3.3

## Testing Expansions (tracked in #140)

- [ ] CFI round-trip unit tests in locator.test.ts — #140 §5.1
- [ ] epub-loader.test.ts with full adapter coverage — #140 §5.2
- [ ] reader-migration-smoke.spec.ts Playwright test — #140 §5.3
- [ ] offline-reader.spec.ts Playwright test — #140 §5.4
- [ ] fast-check property tests in shared and reader-core — #140 §5.5

## Documentation (tracked in #140)

- [ ] ADR-017: epub-engine migration — `plans/017-adr-epub-engine-migration.md` ✅ Created
- [ ] docs/architecture.md — #140 §6.2
- [ ] docs/security.md — #140 §6.2
- [ ] docs/offline.md — #140 §6.2
- [ ] docs/runbooks/reader-rendering.md — #140 §6.3
