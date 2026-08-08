# GOAP Plan 079 — Open Issues × 2026 Best Practices Sprint

**Date:** 2026-06-11
**Goal:** Resolve all 18 open issues (#480–#497) using 2026 web platform standards
**Strategy:** Hybrid — phased sequential + parallel within each phase

---

## Phase 0: Analyze

### Issue Clusters (by dependency order)

| Cluster | Issues | Theme | Depends On |
|---------|--------|-------|-----------|
| A | #489, #497 | Design Token System (OKLCH, fluid, dark mode) | — |
| B | #490, #485 | i18n Infrastructure (persistence, RTL readiness) | — |
| C | #491 | Error Handling (structured errors, boundary, toast) | — |
| D | #492 | Logging & Tracing (structured, sendBeacon, Cloudflare) | C |
| E | #493 | Security Hardening (CSP, cookies, auth, OWASP) | — |
| F | #494 | Responsive App Shell (bottom bar, drawer, sidebar) | A |
| G | #495 | PWA Banner Redesign (toast component, a11y) | A, B |
| H | #480–#484, #486–#488 | Login Fixes (a11y, UX, branding, dark toggle) | A, B, C |
| I | #496 | Login Page Full Redesign | A, B, C, F, G, H |
| J | #483 | Forgot Password / Magic Link Flow | H, E |

### Codebase State (existing assets)

- `apps/web/src/styles/globals.css` — 147 token references, HSL-based (NOT OKLCH)
- `apps/web/src/i18n/` — en/de/fr.ts files, `useTranslation` hook, locale store
- `apps/web/src/components/ErrorBoundary.tsx` — basic error boundary exists
- `packages/shared/src/errors.ts` — AppError class exists
- `apps/web/src/lib/client-logger.ts` — basic logger exists
- `apps/web/src/lib/api.ts` — traceId attached to requests
- `apps/web/public/_headers` — CSP exists
- `apps/worker/src/lib/security-headers.ts` — worker CSP middleware exists
- No `AppShell`, no responsive nav, no bottom tab bar
- PWA notification is raw text (`SwUpdateNotification.tsx`)
- Login page has loading state but no proper labels/branding/dark toggle

---

## Phase 1: Foundation (Parallel — No Dependencies)

Execute clusters A, B, C, E in parallel.

### 1A. Design Token System Upgrade (#489, #497)

**Goal:** Migrate `globals.css` from HSL → OKLCH with 3-tier architecture.

**Tasks:**
1. Create `packages/ui/src/styles/tokens.css` — OKLCH primitives
2. Create `packages/ui/src/styles/base.css` — CSS reset + base styles
3. Upgrade `apps/web/src/styles/globals.css` — semantic token layer using OKLCH
4. Add fluid type scale: `clamp()` with `vi` units (Utopia-based)
5. Add fluid spacing scale (T-shirt naming, 4px base)
6. Define `[data-theme="dark"]` token overrides in OKLCH
7. Add FOUC-prevention inline script in `apps/web/index.html`
8. Update font loading (Cabinet Grotesk + Satoshi + Source Serif 4)
9. Create/update `.agents/skills/design-tokens/SKILL.md`
10. Update `.agents/skills/anti-ai-slop/SKILL.md`

**2026 Standards Applied:**
- OKLCH for all colors (perceptually uniform, P3 gamut)
- `color-mix(in oklch)` for derived states (hover, active)
- `contrast-color()` with `@supports` fallback
- Container query length units (`cqi`) for component-level fluid sizing
- `prefers-reduced-motion` blanket suppression
- `forced-colors` fallbacks for Windows High Contrast
- Minimum 4.5:1 contrast ratio (WCAG 2.2 AA)

**Files touched:**
- `packages/ui/src/styles/tokens.css` (new)
- `packages/ui/src/styles/base.css` (new)
- `apps/web/src/styles/globals.css` (upgrade)
- `apps/web/index.html` (font loading + FOUC script)
- `.agents/skills/design-tokens/SKILL.md` (create/update)
- `.agents/skills/anti-ai-slop/SKILL.md` (update)

---

### 1B. i18n Infrastructure Completion (#490, #485)

**Goal:** Complete i18n with cookie persistence, typed keys, RTL readiness.

**Tasks:**
1. Add cookie-based locale persistence (`do-epub-locale`, SameSite=Lax, 1yr)
2. Update locale store to read from cookie → `navigator.language` → `'en'`
3. Set `document.documentElement.lang` on locale change
4. Add `dir` attribute infrastructure for RTL readiness
5. Generate TypeScript types from translation key structure
6. Add `Intl.DateTimeFormat` / `Intl.NumberFormat` / `Intl.RelativeTimeFormat` utilities
7. Verify all 3 locales have complete coverage (no missing keys)
8. Add E2E test for locale persistence across page reload

**2026 Standards Applied:**
- Cookie storage (not localStorage) for Cloudflare Pages edge compatibility
- `Intl` API usage for all date/number formatting
- Typed translation keys (compile-time safety)
- `dir` attribute on `<html>` for future RTL

**Files touched:**
- `apps/web/src/stores/locale.ts` (upgrade)
- `apps/web/src/i18n/index.ts` (upgrade)
- `apps/web/src/i18n/types.ts` (new — typed keys)
- `apps/web/src/utils/format.ts` (new — Intl wrappers)
- `apps/web/src/i18n/en.ts`, `de.ts`, `fr.ts` (add missing keys)

---

### 1C. Error Handling Enhancement (#491)

**Goal:** Structured error types, global handlers, toast system, error routes.

**Tasks:**
1. Enhance `packages/shared/src/errors.ts` with typed `ErrorCode` enum
2. Add `toUserMessage(t)` method using i18n keys
3. Enhance `ErrorBoundary.tsx` — graceful full-page error state with retry
4. Add `unhandledrejection` + `error` window listeners in `main.tsx`
5. Create `packages/ui/src/components/ToastStack.tsx` — 4 severity levels
6. Add inline form validation pattern with `aria-describedby`
7. Add `/404` and `/error` route pages
8. Add Vitest tests for `AppError.toUserMessage()`

**2026 Standards Applied:**
- `role="alert"` + `aria-live="assertive"` for errors, `"polite"` for info
- No raw error codes shown to users
- Error messages use i18n keys
- Toast position respects safe-area-inset-bottom

**Files touched:**
- `packages/shared/src/errors.ts` (enhance)
- `apps/web/src/components/ErrorBoundary.tsx` (enhance)
- `apps/web/src/main.tsx` (add global handlers)
- `packages/ui/src/components/ToastStack.tsx` (new)
- `apps/web/src/pages/NotFoundPage.tsx` (new)
- `apps/web/src/pages/ErrorPage.tsx` (new)

---

### 1E. Security Hardening (#493)

**Goal:** Harden CSP, cookie policy, session storage, input sanitization.

**Tasks:**
1. Audit and upgrade `apps/web/public/_headers` CSP directives
2. Verify worker CSP in `apps/worker/src/lib/security-headers.ts`
3. Ensure auth tokens use HttpOnly cookies or in-memory only (never localStorage)
4. Add `autocomplete` attributes to all login form inputs
5. Add rate-limit UI feedback (HTTP 429 → inline countdown error)
6. Verify DOMPurify usage for EPUB metadata rendering
7. Add `pnpm audit --audit-level=high` to CI
8. Add gitleaks scan to CI workflow
9. Update `.agents/skills/security-code-auditor/SKILL.md`

**2026 Standards Applied:**
- OWASP Top 10 2025 compliance
- `SameSite=Strict` + `Secure` + `HttpOnly` cookie attributes
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- No tokens in localStorage/sessionStorage
- WebAuthn/passkeys readiness (WCAG 3.3.8 Accessible Auth)

**Files touched:**
- `apps/web/public/_headers` (upgrade)
- `apps/worker/src/lib/security-headers.ts` (verify/upgrade)
- `.github/workflows/ci.yml` (add audit + gitleaks)
- `.agents/skills/security-code-auditor/SKILL.md` (update)

---

## Phase 2: Infrastructure (Sequential — Depends on Phase 1)

### 2D. Structured Logging & Tracing (#492)

**Depends on:** 1C (error types)

**Tasks:**
1. Create `Logger` interface in packages with 4 levels + `withTrace()`
2. Create console logger (dev) — colored, structured
3. Create remote logger — `sendBeacon` to Cloudflare Analytics Engine
4. Generate traceId per navigation, attach as `X-Trace-Id` header
5. Add performance marks for key journeys (login, EPUB load, navigation)
6. Configure via `VITE_LOG_LEVEL` environment variable
7. Ensure no PII ever logged
8. Unit tests for batching and trace propagation

**2026 Standards Applied:**
- `navigator.sendBeacon()` for reliable non-blocking delivery
- `crypto.randomUUID()` for trace IDs
- `Performance.mark()` / `Performance.measure()` for Web Vitals attribution
- Buffer flush on `visibilitychange` event
- Privacy-preserving: no email, password, tokens in logs

**Files touched:**
- `packages/shared/src/logger.ts` (new — interface)
- `apps/web/src/lib/loggers/console.ts` (new)
- `apps/web/src/lib/loggers/remote.ts` (new)
- `apps/web/src/lib/client-logger.ts` (upgrade to new interface)
- `apps/web/src/main.tsx` (traceId setup)

---

### 2F. Responsive App Shell (#494)

**Depends on:** 1A (design tokens)

**Tasks:**
1. Create `packages/ui/src/components/AppShell.tsx` — grid layout
2. Create `packages/ui/src/components/BottomTabBar.tsx` — mobile (<768px)
3. Create `packages/ui/src/components/TopBar.tsx` — sticky, backdrop blur
4. Create `packages/ui/src/components/Sidebar.tsx` — desktop (≥1024px)
5. Create `packages/ui/src/components/Drawer.tsx` — tablet overlay (768–1023px)
6. Wire into `App.tsx` — wrap authenticated routes only
7. Login/auth pages render OUTSIDE AppShell
8. Ensure single scroll region (only `<main>` scrolls)
9. Apply `scroll-padding-top` for sticky header (WCAG 2.4.11)
10. Handle `env(safe-area-inset-bottom)` for iOS

**2026 Standards Applied:**
- CSS Grid + `100dvh` for app shell
- Container queries for component-level breakpoints
- `overscroll-behavior: contain` for scroll isolation
- `role="tablist"` + `aria-selected` on bottom nav
- `aria-current="page"` on active nav item
- Navigation Rail pattern for tablet intermediate (72px icon-only sidebar)
- `backdrop-filter: blur(12px)` on top bar scroll

**Files touched:**
- `packages/ui/src/components/AppShell.tsx` (new)
- `packages/ui/src/components/BottomTabBar.tsx` (new)
- `packages/ui/src/components/TopBar.tsx` (new)
- `packages/ui/src/components/Sidebar.tsx` (new)
- `packages/ui/src/components/Drawer.tsx` (new)
- `apps/web/src/App.tsx` (wrap routes)

---

### 2G. PWA Banner Redesign (#495)

**Depends on:** 1A (tokens), 1B (i18n)

**Tasks:**
1. Create `packages/ui/src/components/PwaBanner.tsx` — 3 variants
2. Fixed pill at bottom, above bottom nav, `z-index: 200`
3. `role="status"` + `aria-live="polite"`, dismiss with full `aria-label`
4. Auto-dismiss: offline-ready 6s, update-available never, offline on reconnect
5. Respect `prefers-reduced-motion` (no slide-up animation)
6. Ensure 4.5:1 contrast on banner text (use `--color-text`, not `--text-muted`)
7. Min 44px touch target on dismiss button
8. All strings via i18n translation keys
9. Update `.agents/skills/pwa-offline-sync/SKILL.md`

**Files touched:**
- `packages/ui/src/components/PwaBanner.tsx` (new)
- `apps/web/src/components/SwUpdateNotification.tsx` (replace with PwaBanner)
- `.agents/skills/pwa-offline-sync/SKILL.md` (update)

---

## Phase 3: Login Fixes (Parallel — Depends on Phase 1)

### 3H. Login Page A11y + UX Fixes (#480–#484, #486–#488)

**Depends on:** 1A (tokens), 1B (i18n), 1C (errors)

Execute in parallel as atomic fixes:

| Sub | Issue | Fix |
|-----|-------|-----|
| H1 | #481 | Change label to "Password" + helper text for optional |
| H2 | #482 | Style "Back to Reader Login" as visible link with context |
| H3 | #484 | Add `<label for>` elements, `autocomplete` attributes |
| H4 | #487 | Move `id="main-content"` to `<main>`, add `tabindex="-1"` |
| H5 | #480 | Add dark mode toggle (sun/moon icon, 44px target) |
| H6 | #486 | Add inline SVG logo with `aria-label` + `role="img"` |
| H7 | #488 | Loading state (already partially exists — verify completeness) |

**2026 Standards Applied:**
- WCAG 2.2 SC 2.5.8: All targets ≥ 24px (44px recommended)
- WCAG 2.2 SC 2.4.11: Focus never obscured by sticky elements
- WCAG 2.2 SC 3.3.8: Support paste + password managers (accessible auth)
- `autocomplete="email"` + `autocomplete="current-password"`
- Skip link is first focusable element, visible on `:focus-visible`

**Files touched:**
- `apps/web/src/features/auth/LoginPage.tsx` (upgrade)
- `apps/web/src/components/ThemeToggle.tsx` (new)
- `apps/web/src/components/AppLogo.tsx` (new)

---

## Phase 4: Login Redesign (Sequential — Depends on Phase 2+3)

### 4I. Complete Login Page Redesign (#496)

**Depends on:** All of Phase 1, 2F (shell), 2G (PWA banner), 3H (fixes)

**Tasks:**
1. Rebuild `LoginPage.tsx` using component structure from issue spec
2. Top utility bar: `<LocaleSelect />` + `<ThemeToggle />`
3. Auth card: logo, heading, form fields, error state, submit button
4. All strings via i18n keys
5. Inline error with `role="alert"` on auth failure
6. PWA banner rendered outside card
7. Verify at 375px, 768px, 1280px, 1920px
8. No gradient buttons, no icon-in-circle, no centered-everything (anti-slop)
9. E2E test: login flow, error state, responsive breakpoints

---

### 4J. Forgot Password / Magic Link (#483)

**Depends on:** 3H, 1E (security)

**Tasks:**
1. Add "Forgot password?" link below password field
2. Inline panel/modal asking for email
3. Pre-fill email from main form
4. API endpoint for password reset / magic link
5. Success/error states with clear messaging
6. Keyboard accessible, all interactive elements have `aria-label`

---

## Phase 5: Skill Updates & Documentation

### Tasks:
1. Update `.agents/skills/design-tokens/SKILL.md` — OKLCH rules, 3-tier architecture
2. Update `.agents/skills/anti-ai-slop/SKILL.md` — expanded pattern blacklist
3. Update `.agents/skills/security-code-auditor/SKILL.md` — 2026 OWASP checklist
4. Update `.agents/skills/pwa-offline-sync/SKILL.md` — PwaBanner spec
5. Update `.agents/skills/accessibility-auditor/SKILL.md` — WCAG 2.2 additions
6. Verify AGENTS.md design system compliance section is present

---

## Execution Strategy

```
Phase 0  ─────────────── ANALYZE (this plan)
                │
Phase 1  ─── [A] [B] [C] [E] ─── PARALLEL
                │
Phase 2  ─── [D]→[F]→[G] ────── SEQUENTIAL
                │
Phase 3  ─── [H1..H7] ────────── PARALLEL
                │
Phase 4  ─── [I]→[J] ─────────── SEQUENTIAL
                │
Phase 5  ─── Skills & Docs ───── PARALLEL
```

**Estimated effort:** 5 sprints across 3 agent sessions
**Quality gates:** `./scripts/quality_gate.sh` after each cluster

---

## Success Criteria

- [ ] All 18 issues (#480–#497) have code changes addressing their acceptance criteria
- [ ] OKLCH tokens in use, no hardcoded hex in components
- [ ] Dark mode toggle functional on all pages
- [ ] Responsive app shell works at 375px, 768px, 1024px, 1280px, 1920px
- [ ] All login inputs have `<label for>`, `autocomplete`, proper ARIA
- [ ] PWA banner meets 4.5:1 contrast, 44px touch targets
- [ ] i18n keys cover all UI strings, locale persists via cookie
- [ ] Structured logging with traceId on all outbound requests
- [ ] CSP headers pass security scan, no tokens in localStorage
- [ ] Agent skills updated to reflect 2026 patterns
- [ ] E2E tests pass for login flow and responsive breakpoints
- [ ] Quality gate green before any merge

---

## Related Plans

- `081-goap-additional-improvements-2026-06-11.md` — 10 codebase gaps found during
  analysis that fold into the clusters above (localStorage→cookie, CSP enforcing,
  forced-colors, autocomplete, ErrorBoundary i18n, font stack, container queries, etc.)
- `082-goap-modern-ui-design-overhaul-2026-06-11.md` — Editorial Minimalist UI
  direction, glassmorphism deprecation, missing features (Library, Search, Toast,
  Offline UI, Empty States, Keyboard Shortcuts, Profile page)
- `082-adr-editorial-minimalist-ui-direction.md` — Art direction decisions,
  color palette shift, typography branding, motion restraint, feature priorities

---

## GitHub Issues Updated (2026-06-11)

All 18 issues (#480–#497) received analysis comments with:
- Current codebase state (what exists vs what's missing)
- Specific plan/cluster/task references
- No issues closed (all partially addressed, none fully resolved)

---

## Agent Skill References

- `.agents/skills/goap-agent/` — planning methodology
- `.agents/skills/design-tokens/` — token system rules
- `.agents/skills/anti-ai-slop/` — UI pattern blacklist
- `.agents/skills/accessibility-auditor/` — WCAG 2.2 compliance
- `.agents/skills/reader-ui-ux/` — responsive UX patterns
- `.agents/skills/security-code-auditor/` — OWASP/CSP rules
- `.agents/skills/pwa-offline-sync/` — PWA banner specs
- `.agents/skills/privacy-first/` — no PII in logs
