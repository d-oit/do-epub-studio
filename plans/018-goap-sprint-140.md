# Plan 018: GOAP Sprint Plan — Issue #140 Codebase Optimization & Quality Sprint

**Date:** 2026-05-13
**Goal:** Complete all open items from issue #140 across 7 work packages
**Branch:** `sprint-140-codebase-optimization`
**Strategy:** Hybrid — independent phases in parallel, dependent tasks sequential within phases

---

## Dependency Map

```
Phase 1 (Reader Hardening) ──────────────────┐
Phase 2 (Security) ───────────────────────────┤
Phase 3 (Features) ─── depends-on: Phase 1 ──┤── all independent → parallel swarm
Phase 4 (Code Quality) ──────────────────────┤
Phase 5 (Testing) ───── depends-on: Phase 1 ─┤
Phase 6 (Docs) ──────────────────────────────┤
Phase 7 (Tooling) ───────────────────────────┘
```

---

## Phase 1: Reader Engine Hardening (P0-P2)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 1.1 | Telemetry dedup: remove local generateTraceId/generateSpanId/formatError, import from shared | P2 | none | `code-quality` |
| 1.2 | Expose `flow` and `manager` rendition options in EpubLoader API | P2 | none | `epub-rendering-and-cfi` |
| 1.3 | Type `getContents()` with Contents type, expose DOM access | P2 | none | `epub-rendering-and-cfi` |
| 1.4 | Add `registerContentHook` / `registerRenderHook` to adapter | P2 | 1.3 | `epub-rendering-and-cfi` |
| 1.5 | Add keyboard navigation (arrow keys) in ReaderPage + E2E test | P2 | none | `reader-ui-ux`, `testing-strategy` |

### Quality Gate: `./scripts/minimal_quality_gate.sh` on reader-core + web

## Phase 2: Security (P0-P3)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 2.1 | Enforce multi-signal locators in schema + worker validation | P0 | none | `security-code-auditor` |
| 2.2 | Document/address in-memory rate limiter limitation | P3 | none | `security-code-auditor` |
| 2.3 | Audit session expiry enforcement across all routes; add 401 test | P0 | none | `secure-invite-and-access` |
| 2.4 | Update vite-plugin-pwa; audit xmldom; remove @lhci/cli if unused | P4 | none | `cicd-pipeline` |

### Quality Gate: `./scripts/minimal_quality_gate.sh` on worker + shared

## Phase 3: Features (P1-P3)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 3.1 | Wire ReaderPage to backend: progress hydration, sync, offline restore, capability gates | P1 | 1.4 | `reader-ui-ux`, `pwa-offline-sync` |
| 3.2 | Restore annotations on displayed event via content hook | P1 | 1.4, 1.5 | `epub-rendering-and-cfi`, `reader-ui-ux` |
| 3.3 | Implement CreateBookModal and GrantManagement in Admin UI | P3 | none | `reader-ui-ux` |

### Quality Gate: `./scripts/minimal_quality_gate.sh` on web + worker

## Phase 4: Code Quality (P2)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 4.1 | Add traceId to sync.ts and sw.ts | P2 | none | `code-quality` |
| 4.2 | Fix memory leaks (toast, global handler, sync retry, db close) | P2 | none | `code-quality` |
| 4.3 | Delete duplicate telemetry.ts in apps/web; import from shared | P2 | none | `code-quality` |
| 4.4 | Audit Promise.all → Promise.allSettled where appropriate | P2 | none | `code-quality` |

### Quality Gate: `./scripts/minimal_quality_gate.sh` on web

## Phase 5: Testing (P1-P4)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 5.1 | Add CFI round-trip unit tests to locator.test.ts | P2 | Phase 1 | `testing-strategy` |
| 5.2 | Create epub-loader.test.ts with full adapter coverage | P1 | none | `testing-strategy` |
| 5.3 | Add reader-migration-smoke.spec.ts Playwright test | P1 | none | `testing-strategy` |
| 5.4 | Add offline-reader.spec.ts Playwright test | P3 | none | `testing-strategy` |
| 5.5 | Add fast-check property tests to shared and reader-core | P4 | none | `testing-strategy` |

### Quality Gate: `npm run test:coverage` on affected packages

## Phase 6: Documentation (P3)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 6.1 | ADR-017 already created ✅ | done | none | (complete) |
| 6.2 | Author docs/architecture.md, docs/security.md, docs/offline.md | P3 | none | `code-quality` |
| 6.3 | Create docs/runbooks/reader-rendering.md | P3 | none | `epub-rendering-and-cfi` |

## Phase 7: Package & Tooling (P4)

| ID | Task | Priority | Deps | Skills Required |
|----|------|----------|------|-----------------|
| 7.1 | Apply routine dependency updates (TS, vitest, prettier, eslint) | P4 | none | `cicd-pipeline` |
| 7.2 | Move shared UI components to packages/ui | P4 | none | `migration-refactoring` |
| 7.3 | Fix or document Lighthouse CI NO_FCP issue | P4 | none | `cicd-pipeline` |

---

## Execution Strategy

### Swarm 1 (Parallel): Phases 1, 2, 4, 5, 6, 7
All independent — launch concurrent agents.

### Swarm 2 (Sequential): Phase 3
Depends on Phase 1 completion (hook registration needed for wire).

### Final: Quality gate + PR
- Run full `./scripts/quality_gate.sh`
- Commit via `./scripts/atomic-commit/run.sh`
- Push branch, verify GHA

---

## Success Criteria

- [ ] epub-loader.ts imports telemetry from shared; no local duplicates
- [ ] EpubLoader API exposes flow, manager, typed Contents, hook registration
- [ ] ReaderPage hydrates progress, syncs relocations, restores offline position, gates capabilities
- [ ] Annotations re-applied after every displayed event
- [ ] Multi-signal locator schema enforced server-side with tests
- [ ] Session expiry validated on all authenticated routes
- [ ] epub-loader.test.ts exists with full unit coverage
- [ ] reader-migration-smoke.spec.ts passes in CI
- [ ] All identified memory leaks resolved
- [ ] Duplicate telemetry module removed
- [ ] All plan files updated to reflect current status
