# Quality Backlog

- [x] Resolve React 18 / Vitest concurrency issues (switched to forks)
- [x] Implement edge-case E2E tests (network errors, 401s)
- [x] Centralize API trace-id propagation
- [x] **Package Security Updates** - Fix serialize-javascript and xmldom vulnerabilities
- [x] **Memory Leak Fixes** - Toast timeout cleanup, global error handler isolation
- [x] **Error Handling Improvements** - Create error utility, fix Promise.all issues
- [x] Lighthouse CI — `@lhci/cli` removed (unused, no CI workflow, SPA architecture requires backend for meaningful results) — #140 §7.3
- [x] Move shared UI components to @do-epub-studio/ui — tracked in #140 §7.2 (apps/web/ui/index.tsx now re-exports from package)

## Dependency Audit (2026-05-14)

| Dependency | Location | Version | Status |
|---|---|---|---|
| vite-plugin-pwa | `apps/web/package.json` | `^1.3.0` | Current stable |
| @lhci/cli | `package.json` (root) | `^0.15.1` | Current stable |

## epub-js Migration Follow-Up (May 2026)

Issue #128 closed; all follow-up work tracked in **[issue #140](https://github.com/d-oit/do-epub-studio/issues/140)**, completed via PR #142.

### Reader Engine Hardening (Phase 1 of sprint)
- [x] Remove duplicate telemetry helpers from epub-loader.ts → import from shared (#140 §1.1)
- [x] Expose `flow` and `manager` options in EpubLoader API (#140 §1.2)
- [x] Type `getContents()` with Contents type; expose DOM access (#140 §1.3)
- [x] Add `registerContentHook` / `registerRenderHook` to adapter (#140 §1.4)
- [x] Add keyboard navigation in ReaderPage + E2E test (#140 §1.5)

## Security Updates (April–May 2026)

### Critical Security Fixes Required

- [x] **vite-plugin-pwa** - ^1.3.0 is current stable; no security update available — #140 §2.4
- [x] **@intity/epub-js** - No @xmldom/xmldom found in dependency tree (not a transitive dep) — #140 §2.4
- [x] **@lhci/cli** - Removed (unused, no CI workflow) — #140 §2.4
- [x] **Rate limiting** - DurableObjects implementation created (`rate-limiter-do.ts`); in-memory fallback still has TODO — #140 §2.2
- [x] **Multi-signal locators** - Enforce in schema + worker validation — #140 §2.1
- [x] **Session expiry** - Validate on all authenticated routes — #140 §2.3

### Security Improvements

- [x] **Argon2id password hashing** - Already implemented per AGENTS.md
- [x] **Zod validation** - All inputs validated
- [x] **SQL parameterization** - No injection risks
- [ ] **Test credentials** - Move to environment variables _(tracked: issue #169 · Plan 038 Group D)_

## Error Handling & Logging (April 2026)

- [x] **TraceId Implementation** - Worker has full implementation
- [x] **Global error handlers** - Both web and worker have handlers
- [x] **Consolidate telemetry.ts** - Removed duplicate in apps/web; imports from shared — #140 §4.3
- [x] **Import shared traceId** - reader-core imports from shared — #140 §1.1
- [x] **Add traceId to sync.ts** - Done (sync.ts:82 uses createTraceId) — #140 §4.1
- [x] **Add traceId to sw.ts** - Done (sw.ts:90 uses createTraceId) — #140 §4.1
- [x] **Promise.all → Promise.allSettled** — No `Promise.all` exists in worker routes (all async operations are sequential/individual awaits) — no change needed — #140 §4.4

## Memory Leak Fixes (April–May 2026)

### High Priority

- [x] **Toast timeout cleanup** - `packages/ui/src/toast.tsx:27` - Track and clear timeouts — #140 §4.2
- [x] **Global error handler isolation** - `apps/web/src/main.tsx:38` - Fix for testing/HMR — #140 §4.2

### Medium Priority

- [x] **Sync retry timeout** - `apps/web/src/lib/offline/sync.ts:97` - Continue after unmount — #140 §4.2
- [x] **IndexedDB explicit close** - `apps/web/src/lib/offline/db.ts` - Add close function — #140 §4.2

## Package Updates (April–May 2026)

### Immediate (Security)

- [x] `vite-plugin-pwa`: ^1.3.0 is current stable — no update needed
- [x] `@intity/epub-js`: No @xmldom/xmldom found in dependency tree

### High Priority

- [x] `eslint`: 9.39.4 → 10.x (breaking change — audit config) — #140 §7.1
- [x] `@eslint/js`: 9.39.4 → 10.0.1
- [x] `eslint-plugin-security`: 3.0.1 → 4.0.0
- [x] `globals`: 15.15.0 → 17.5.0

### Routine

- [x] `typescript`: 6.0.2 → 6.0.3 — #140 §7.1
- [x] `vitest`: 4.1.4 → 4.1.5 — #140 §7.1
- [x] `prettier`: 3.8.1 → 3.8.3 — #140 §7.1
- [x] `typescript-eslint`: 8.58.1 → 8.59.1 — #140 §7.1

## Resolved Infrastructure Updates (April 2026)

- [x] **TypeScript 7.0 Preparation**: Fixed `baseUrl` deprecations in `tsconfig.base.json`.
- [x] **Vite 8 Migration**: Refactored `apps/web/vite.config.ts` for Rolldown compatibility.
- [x] **Vitest 4 Fix**: Resolved the `offline-sync.test.ts` regression.
- [x] **Tailwind 4 Engine**: Refactored `apps/web/src/styles/globals.css` for the Tailwind 4 engine and integrated via Vite plugin.
- [x] **Accessibility Hardening**: Applied `useId` and `aria-busy` patterns to `packages/ui` and local components.
- [x] **epub-js migration**: Migrated from `futurepress/epub.js` to `intity/epub-js` with adapter layer (#128).

## Feature Gap Closures (tracked in #140)

- [x] Reader UI wired to backend (progress hydration, sync, offline restore, capability gates) — #140 §3.1
- [x] Annotation restore on displayed event — #140 §3.2
- [x] Admin UI: GrantManagement component — #140 §3.3 (already implemented as GrantsPage + GrantForm/GrantList)
- [x] Admin UI: CreateBook form — exists in BooksPage.tsx (inline form, not a modal)

## Testing Expansions (tracked in #140)

- [x] CFI round-trip unit tests in locator.test.ts — #140 §5.1 (68 tests)
- [x] epub-loader.test.ts with full adapter coverage — #140 §5.2
- [x] reader-migration-smoke.spec.ts Playwright test — #140 §5.3
- [x] offline-reader.spec.ts Playwright test — #140 §5.4
- [x] fast-check property tests in shared and reader-core — #140 §5.5

## Documentation (tracked in #140)

- [x] ADR-017: epub-engine migration — `docs/plans/017-adr-epub-engine-migration.md` ✅ Created
- [x] docs/architecture.md — #140 §6.2
- [x] docs/security.md — #140 §6.2
- [x] docs/offline.md — #140 §6.2
- [x] docs/runbooks/reader-rendering.md — #140 §6.3
