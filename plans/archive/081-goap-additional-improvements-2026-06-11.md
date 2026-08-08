# GOAP Plan 081 — Additional Codebase Improvements Beyond Open Issues

**Date:** 2026-06-11
**Goal:** Address 10 improvements found during analysis not covered by existing issues
**Strategy:** Integrate into existing phase execution from plan 079

---

## Analyze

During codebase analysis against open issues, 10 additional improvements were
identified that are not independently tracked as GitHub issues but need attention.
These are folded into the parent clusters from plan 079.

---

## Improvements Found

### 1. Locale store uses localStorage (not cookies)

**File:** `apps/web/src/stores/locale.ts`
**Problem:** Uses `persist` middleware (localStorage). Breaks Cloudflare Pages edge
rendering and SSR. Issue #485/#490 mentions cookie persistence but the gap is larger
than just persistence — the entire store pattern needs refactoring.
**Fix:** Replace Zustand persist with cookie read/write in store initialization.
**Folded into:** Cluster B (Task B1)

### 2. CSP is Report-Only, not enforcing

**File:** `apps/web/public/_headers`
**Problem:** Header is `Content-Security-Policy-Report-Only`. No protection in effect.
**Fix:** Switch to `Content-Security-Policy` (enforcing) after verifying directives.
**Folded into:** Cluster E (Task E1)

### 3. AppShell is redirect-only, not a layout

**File:** `apps/web/src/components/AppShell.tsx`
**Problem:** Component resolves auth and navigates away. Not a persistent layout shell.
**Fix:** Complete rebuild into responsive grid layout (Cluster F).
**Folded into:** Cluster F (Tasks F1-F6)

### 4. No container queries in CSS

**Files:** All component CSS / Tailwind classes
**Problem:** All responsiveness is viewport-based. No component-level adaptation.
**Fix:** Add `container` declarations on key wrappers (card grids, reader panels).
Use `@container` for component breakpoints per 2026 best practice.
**New task:** Add to Cluster A post-token work.

### 5. No forced-colors media query support

**File:** `apps/web/src/styles/globals.css`
**Problem:** No `@media (forced-colors: active)` declarations. Windows High Contrast
users see broken shadows/borders.
**Fix:** Add `forced-colors` fallbacks: borders where shadows exist, system color keywords.
**Folded into:** Cluster A (add to base.css creation)

### 6. Login inputs missing autocomplete attributes

**File:** `apps/web/src/features/auth/LoginPage.tsx`
**Problem:** `<input type="email">` has no `autocomplete="email"`. Password has no
`autocomplete="current-password"`. Browser credential managers can't assist.
**Fix:** Add autocomplete attributes to both inputs.
**Folded into:** Cluster H (Task H3)

### 7. ErrorBoundary has hardcoded English strings

**File:** `apps/web/src/components/ErrorBoundary.tsx`
**Problem:** Contains hardcoded "Something went wrong", "Try Again", "Reload Page".
Not using i18n translation keys.
**Fix:** Pass `t()` function or use i18n hook in class component (static method pattern).
**Folded into:** Cluster C (Task C2)

### 8. SwUpdateNotification positioned at top (conflicts with #495)

**File:** `apps/web/src/components/SwUpdateNotification.tsx`
**Problem:** Banner slides in from top (`y: -80`). Issue #495 spec requires bottom
position above bottom nav bar.
**Fix:** Move to bottom position in PwaBanner redesign.
**Folded into:** Cluster G (Task G1)

### 9. No scroll-padding-top for sticky headers

**File:** `apps/web/src/styles/globals.css`
**Problem:** No `scroll-padding-top` set. When responsive nav with sticky TopBar is
added (Cluster F), focused elements will be hidden behind it (WCAG 2.4.11 violation).
**Fix:** Add `html { scroll-padding-top: var(--header-height, 56px); }` to base styles.
**Folded into:** Cluster F (Task F6)

### 10. Font family uses Inter, not specified design stack

**File:** `apps/web/src/styles/globals.css` (line ~69)
**Problem:** `font-family: 'Inter', system-ui, ...` — not the specified Cabinet
Grotesk (display) + Satoshi (body) + Source Serif 4 (reader) per issues #489/#497.
**Fix:** Update font-family variables and add font loading to index.html.
**Folded into:** Cluster A (Tasks A1, A4)

---

## Execution Priority

These improvements are NOT separate work items — they're embedded into existing
clusters from plan 079. Priority is inherited from parent cluster:

| Improvement | Parent Cluster | Phase | Priority |
|-------------|---------------|-------|----------|
| #1 localStorage→cookie | B (i18n) | 1 | High |
| #2 CSP enforcing | E (Security) | 1 | High |
| #5 forced-colors | A (Tokens) | 1 | Medium |
| #6 autocomplete | H (Login fixes) | 3 | Medium |
| #7 i18n in ErrorBoundary | C (Errors) | 1 | Medium |
| #10 font stack | A (Tokens) | 1 | Medium |
| #3 AppShell rebuild | F (Navigation) | 2 | High |
| #8 banner position | G (PWA Banner) | 2 | Medium |
| #9 scroll-padding | F (Navigation) | 2 | Low |
| #4 container queries | A (Tokens) | 2 | Low |

---

## Quality Gate

All improvements verified by `./scripts/quality_gate.sh` as part of their parent
cluster completion. No separate validation needed.

## Agent Skill References

- `.agents/skills/accessibility-auditor/` — forced-colors, scroll-padding, autocomplete
- `.agents/skills/security-code-auditor/` — CSP enforcement
- `.agents/skills/design-tokens/` — font stack, container queries
