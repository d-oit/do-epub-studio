# Plan 030: GOAP Swarm — Remaining Implementation Gaps

**Date:** 2026-05-15
**Goal:** Fix all truly open items found by audit: e2e.yml bug, benchmark CI, hardcoded credentials, codecov enhancements
**Status:** ✅ **COMPLETED** — PR #149 merged; all groups resolved
**Strategy:** Hybrid — parallel swarm for independent groups, sequential quality gate
**Branch:** feat/remaining-implementation-gaps

---

## Audit Findings (from deep codebase audit)

| ID | Item | Priority | Status |
|----|------|----------|--------|
| F1 | e2e.yml has broken step (line 43: name with no run/uses) | P0 | 🔴 |
| F2 | codecov/codecov-action@v5 not SHA-pinned | P1 | 🔴 |
| F3 | codecov.yml lacks threshold settings | P2 | 🔴 |
| F4 | Phase 6.1: No benchmark CI step | P3 | 🔴 |
| F5 | Phase 7.7: Hardcoded test credentials in 10 locations | P2 | 🔴 |

---

## Dependency Map

```
Group A (Critical Fixes) ─────┐
Group B (Benchmark CI) ───────┤
Group C (Hardcoded Creds) ────┤── ALL INDEPENDENT → parallel swarm
Group D (codecov Enhance) ────┘
                              ↓
                         Quality Gate → PR → GHA verification
```

## Group A: Critical Bug Fixes (P0-P1)

| ID | File | Fix |
|----|------|-----|
| A1 | `.github/workflows/e2e.yml:43` | Remove duplicate broken step (name with no run/uses) |
| A2 | `.github/workflows/ci.yml` | Pin `codecov/codecov-action@v5` to commit SHA |

## Group B: Benchmark CI (P3)

| ID | File | Fix |
|----|------|-----|
| B1 | `.github/workflows/ci.yml` | Add `bench` job that runs `pnpm bench` after build |

## Group C: Hardcoded Test Credentials → Env Vars (P2)

| ID | File | Locations |
|----|------|-----------|
| C1 | `apps/worker/src/__tests__/fixtures.ts` | TURSO_AUTH_TOKEN, SESSION_SIGNING_SECRET, INVITE_TOKEN_SECRET |
| C2 | `apps/worker/src/__tests__/signed-url.test.ts` | SESSION_SIGNING_SECRET |
| C3 | `apps/worker/src/__tests__/password.test.ts` | hashPassword('test-password') |
| C4 | `apps/web/src/__tests__/api.test.ts` | token: 'my-token' |
| C5 | `apps/web/src/features/admin/AdminLoginPage.test.tsx` | sessionToken: 'test-token' |
| C6 | `apps/tests/login-and-book-load.spec.ts` | password, sessionToken |
| C7 | `apps/tests/reader-annotations-and-admin.spec.ts` | password, sessionToken |
| C8 | `apps/tests/accessibility-audit.spec.ts` | password, sessionToken |
| C9 | `apps/tests/reader-migration-smoke.spec.ts` | password |
| C10 | `apps/tests/offline-reader.spec.ts` | password |

Strategy: Replace hardcoded values with env var references (with fallback defaults for local dev).

## Group D: codecov.yml Enhancement (P2)

| ID | File | Fix |
|----|------|-----|
| D1 | `codecov.yml` | Add `threshold: 2%` to each package target |

---

## Execution Strategy

**Strategy: Hybrid — 4 parallel swarm groups, sequential quality gate**

1. Create branch
2. Launch all Groups A-D in parallel (no cross-dependencies)
3. Run quality gate
4. Atomic commit → push → create PR
5. Monitor GHA, fix failures
6. Update docs/plans/ and learnings

---

## Quality Gates

- [x] `pnpm lint` passes — 0 warnings
- [x] `pnpm typecheck` passes — 7/7 packages clean
- [x] `pnpm test` passes — all tests pass
- [x] `pnpm build` passes
- [x] Workflow YAML validation passes
- [x] GHA CI passes — CodeQL + CI both green

---

## Success Criteria

| Criterion | Status |
|-----------|--------|
| e2e.yml has no broken steps | ✅ |
| codecov-action pinned to SHA | ✅ |
| codecov.yml has threshold settings | ✅ |
| Benchmark job exists in CI | ✅ |
| Hardcoded test credentials replaced with env vars | ✅ |
| TURSO_DATABASE_URL env-varized (Codacy feedback) | ✅ |
| All GHA workflows pass | ✅ |
| Plans/ progress updated | ✅ |
| Learnings compacted | ✅ |
