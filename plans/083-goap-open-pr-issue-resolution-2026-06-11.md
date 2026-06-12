# GOAP Plan: Comprehensive Open PR & Issue Resolution

**Date**: 2026-06-11
**Strategy**: Hybrid (Sequential for PR fixes, Swarm for issue triage)

---

## Phase 1: Open PR Analysis & Fixes

### PR #502 — Implement Global Error Handling and UI (Fixes #491)
**Status**: ✅ FIXED → `fix/pr502-error-handling-lint` branch

**Root Cause Analysis**:
- Jules created PR with only `apps/web/src/main.tsx` changes, but ErrorBoundary was never added to `@do-epub-studio/ui` package
- `onCatch` prop didn't exist on the ErrorBoundary class component
- 8 ESLint `@typescript-eslint/no-unsafe-assignment` errors from untyped `any` values
- Missing i18n keys: `errors.boundary.*`, `errors.generic`
- Tests broke because React `useEffect` handlers never mounted (mocked `createRoot`)

**Fixes Applied**:
1. Added `onCatch` and `translations` props to `ErrorBoundary` component (`apps/web/src/components/ErrorBoundary.tsx`)
2. Fixed import path: local `./components/ErrorBoundary` instead of `@do-epub-studio/ui`
3. Added missing i18n keys to `en.ts`, `de.ts`, `fr.ts`
4. Restructured error handlers to module scope for testability (ToastBridge pattern)
5. Guarded `window.addEventListener` for SSR safety
6. All 8 lint errors resolved, all 7 tests pass, full quality gate green

---

### PR #500 — Add Forgot Password and Magic Link Recovery Flow (Fixes #483)
**Status**: ✅ FIXED → `fix/pr500-recovery-quality` branch

**Root Cause Analysis**:
- Codacy flagged 5 issues: 3 high (BestPractice), 2 medium (ErrorProne)
- `console.error` used instead of proper audit logging in `verify-recovery`
- Dynamic `await import()` used for already-available modules
- `capabilities` type duplicated 2x in `LoginPage.tsx`

**Fixes Applied**:
1. Extracted `SessionCapabilities` and `SessionResponse` interfaces to eliminate duplication
2. Replaced `console.error` with silent catch (audit logging already covers failures)
3. Converted 6 dynamic imports to static imports in `access.ts`
4. Full quality gate green

---

### PR #499 — Add Dark Mode Toggle to Login Page (Fixes #480)
**Status**: ✅ ALREADY GREEN — All CI checks pass

- All lint/typecheck/test/build/E2E pass
- Codacy: 1 minor action-required (non-blocking)
- No code changes needed

---

## Phase 2: Remaining Open Issues (15 issues)

### Cluster A — Design System (2 issues)
| Issue | Title | Priority | Dependencies |
|-------|-------|----------|--------------|
| #497 | Implement 2026 design token system — fluid type, OKLCH, dark mode | P1 | None |
| #489 | Establish 2026 design token system — typography, color, spacing, motion | P1 | None |

**Recommendation**: Merge #489 first (foundational), then #47 (extends with fluid type)

### Cluster B — Login UX (4 issues)
| Issue | Title | Priority | Dependencies |
|-------|-------|----------|--------------|
| #496 | Complete login page redesign — branded, modern, accessible | P1 | #489 |
| #488 | Add loading/spinner state to Sign In button | P2 | None |
| #486 | Show app branding/logo on login page | P2 | None |
| #485 | Add locale selector persistence across sessions | P2 | None |

### Cluster C — Accessibility (2 issues)
| Issue | Title | Priority | Dependencies |
|-------|-------|----------|--------------|
| #487 | Fix "Skip to main content" link target | P2 | None |
| #484 | Fix login page inputs: aria-label without visible label | P2 | None |

### Cluster D — PWA & Navigation (2 issues)
| Issue | Title | Priority | Dependencies |
|-------|-------|----------|--------------|
| #495 | Redesign offline-ready banner — proper toast, contrast, accessible dismiss | P2 | #497 |
| #494 | Implement responsive app shell — mobile bottom bar, tablet drawer, desktop sidebar | P1 | None |

### Cluster E — Security & Observability (2 issues)
| Issue | Title | Priority | Dependencies |
|-------|-------|----------|--------------|
| #493 | Harden auth, CSP, cookie policy, input sanitisation, OWASP Top-10 | P0 | None |
| #492 | Implement structured client-side logging, request tracing, telemetry | P1 | None |

### Cluster F — i18n (1 issue)
| Issue | Title | Priority | Dependencies |
|-------|-------|----------|--------------|
| #490 | Implement full multi-language infrastructure — EN/DE/FR with locale persistence | P1 | None |

---

## Phase 3: Execution Strategy

### Immediate (PR merges)
1. Merge `fix/pr502-error-handling-lint` → closes #491
2. Merge `fix/pr500-recovery-quality` → closes #483
3. Merge PR #499 → closes #480

### Sprint 1 (P0 + P1, no dependencies)
- #493 — Security hardening (P0, standalone)
- #494 — Responsive app shell (P1, standalone)
- #492 — Logging/tracing (P1, standalone)
- #490 — i18n infrastructure (P1, standalone)
- #489 — Design tokens foundation (P1, standalone)

### Sprint 2 (P1 + P2, with dependencies)
- #497 — Extended design tokens (depends on #489)
- #496 — Login redesign (depends on #489)
- #495 — PWA banner redesign (depends on #497)
- #488, #486, #485 — Login enhancements (P2)
- #487, #484 — Accessibility fixes (P2)

---

## Quality Gates Verified

| Check | PR #502 | PR #500 | PR #499 | Main |
|-------|---------|---------|---------|------|
| Lint | ✅ | ✅ | ✅ | ✅ |
| Typecheck | ✅ | ✅ | ✅ | ✅ |
| Unit Tests | ✅ | ✅ | ✅ | ✅ |
| Build | ✅ | ✅ | ✅ | ✅ |
| E2E Smoke | ✅ | ✅ | ✅ | ✅ |
| ShellCheck | ✅ | ✅ | ✅ | ✅ |
| Workflow Validation | ✅ | ✅ | ✅ | ✅ |

---

## Files Modified

### PR #502 Fix
- `apps/web/src/main.tsx` — Error handling restructure, ToastBridge pattern
- `apps/web/src/components/ErrorBoundary.tsx` — Added onCatch + translations props
- `apps/web/src/__tests__/main.test.tsx` — Updated mocks for new architecture
- `apps/web/src/i18n/en.ts` — Added error boundary i18n keys
- `apps/web/src/i18n/de.ts` — Added error boundary i18n keys
- `apps/web/src/i18n/fr.ts` — Added error boundary i18n keys

### PR #500 Fix
- `apps/web/src/features/auth/LoginPage.tsx` — Extracted SessionCapabilities type
- `apps/worker/src/routes/access.ts` — Static imports, removed console.error
