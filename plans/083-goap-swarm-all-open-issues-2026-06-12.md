# GOAP Plan #083: Swarm All Open Issues — 2026-06-12

**Date:** 2026-06-12
**Status:** ✅ COMPLETE
**Strategy:** Hybrid (Sequential foundations + Parallel UI swarm)
**Issues:** 12 open (2 bugs, 10 enhancements) — ALL RESOLVED
**Quality Gate:** Lint ✅ | Typecheck ✅ | 265 tests ✅

---

## Issue Triage

### Already Implemented (Verified & Confirmed)
| # | Title | Status | Evidence |
|---|-------|--------|----------|
| 484 | Login page visible labels | ✅ DONE | `Input` component renders `<label htmlFor>` with `htmlFor` association |
| 485 | Locale selector persistence | ✅ DONE | Zustand `persist` middleware → `do-epub-locale` cookie (1yr, SameSite=Lax) |
| 487 | Skip to main content bug | ✅ DONE | `<main id="main-content" tabIndex={-1}>` + skip link in App.tsx targeting it |
| 488 | Login loading/spinner state | ✅ DONE | `Button` component `isLoading`/`loadingLabel` props, `aria-busy` attribute |

### Newly Implemented
| # | Title | Priority | Files Changed |
|---|-------|----------|---------------|
| 493 | Security hardening | P0 | `apps/web/public/_headers` |
| 486 | Login branding/logo | P1 | `packages/ui/src/AppLogo.tsx`, `LoginPage.tsx` |
| 489/#497 | Design tokens | P0 | `apps/web/src/styles/globals.css`, `apps/web/index.html` |
| 496 | Complete login redesign | P1 | `apps/web/src/features/auth/LoginPage.tsx` |
| 495 | PWA banner redesign | P1 | `apps/web/src/components/SwUpdateNotification.tsx` |
| 494 | Responsive app shell | P1 | `AppShell.tsx`, `BottomTabBar.tsx`, `Sidebar.tsx`, `Drawer.tsx` |
| 492 | Logging/tracing | P2 | `apps/web/src/lib/client-logger.ts` |

---

## Execution Phases

### Phase 1: Foundations (Sequential)
1. **#489/#497** — Design tokens: fluid type scale (`clamp()`), font loading (Instrument Serif + Geist via Google Fonts), spacing scale (4px base), border radius tokens, shadow tokens, base CSS reset (`box-sizing: border-box`)
2. **#493** — Security: Full CSP enforcing mode (not report-only), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`

### Phase 2: UI Components (Parallel Swarm)
3. **#486** — App logo: `AppLogo` SVG component with `role="img"`, `aria-label="do EPUB Studio logo"`, `currentColor` fills for light/dark adaptation, responsive sizing
4. **#495** — PWA banner: Repositioned from top to bottom toast, auto-dismiss after 6s (offline-ready), `aria-live="polite"`, `role="status"`, 3 variants with distinct icons, respects `prefers-reduced-motion`
5. **#494** — Responsive nav: `BottomTabBar` (mobile `<768px`), `Sidebar` (desktop `≥1024px`), `Drawer` (tablet overlay with scrim + escape key), hamburger menu on mobile top bar, `role="tablist"` + `aria-selected` on active nav items
6. **#496** — Login redesign: Centered card layout, AppLogo branding above heading, display font (`--font-display`) heading, "Forgot password?" link, improved error styling with `border-l-3`, proper `noValidate` on form, `inputMode="email"` on email field

### Phase 3: Enhancements
7. **#492** — Logging: Configurable log level via `VITE_LOG_LEVEL` env, remote logger using `navigator.sendBeacon()` for `warn`/`error` entries, flush on `visibilitychange=hidden` and `beforeunload`, `createPerformanceMark()` and `measurePerformance()` utilities for user journey timing

### Phase 4: Verification & i18n
8. Verified #484, #485, #487, #488 are properly implemented
9. Added i18n keys: `nav.*`, `a11y.*`, `login.forgotPassword` (EN/DE/FR parity)
10. Updated `AppShell.test.tsx` with new test for admin redirect path
11. Quality gate: lint ✅, typecheck ✅, 265 tests ✅

---

## Files Created
| File | Purpose |
|------|---------|
| `packages/ui/src/AppLogo.tsx` | SVG logo component |
| `apps/web/src/components/navigation/BottomTabBar.tsx` | Mobile bottom tab navigation |
| `apps/web/src/components/navigation/Sidebar.tsx` | Desktop sidebar navigation |
| `apps/web/src/components/navigation/Drawer.tsx` | Tablet slide-in drawer |
| `apps/web/src/components/navigation/index.ts` | Barrel export |
| `plans/083-goap-swarm-all-open-issues-2026-06-12.md` | This plan |
| `plans/084-adr-comprehensive-open-issues-resolution.md` | ADR |

## Files Modified
| File | Changes |
|------|---------|
| `apps/web/public/_headers` | Full CSP enforcing + 6 security headers |
| `apps/web/index.html` | Font preconnect + Google Fonts stylesheet |
| `apps/web/src/styles/globals.css` | Fluid type scale, spacing, radius, shadows, base reset, @theme expansion |
| `apps/web/src/features/auth/LoginPage.tsx` | Complete redesign: branding, centered card, display font |
| `apps/web/src/components/SwUpdateNotification.tsx` | Bottom toast, auto-dismiss, 3 variants |
| `apps/web/src/components/AppShell.tsx` | Responsive shell with navigation + Outlet |
| `apps/web/src/components/ui/index.tsx` | AppLogo + AppLogoProps re-export |
| `apps/web/src/App.tsx` | Cleanup unused imports |
| `apps/web/src/lib/client-logger.ts` | Remote logger, perf marks, configurable level |
| `packages/ui/src/index.ts` | AppLogo + AppLogoProps export |
| `apps/web/src/i18n/en.ts` | 7 new keys (nav.*, a11y.*, login.forgotPassword) |
| `apps/web/src/i18n/de.ts` | German translations for 7 new keys |
| `apps/web/src/i18n/fr.ts` | French translations for 7 new keys |
| `apps/web/src/__tests__/AppShell.test.tsx` | Updated for new AppShell + admin redirect test |

---

## Quality Gates
- [x] `pnpm run lint` — passes (all 9 workflows validated)
- [x] `pnpm run typecheck` — passes (7/7 packages)
- [x] `pnpm run test:unit` — 265 tests pass (32 test files, 1 new test)
- [x] All new components use design tokens (no hardcoded hex/px values)
- [x] All new strings use i18n keys (EN/DE/FR parity verified by i18n-parity.test.ts)
- [x] Accessibility: ARIA roles (`tablist`, `tab`, `status`, `alert`), labels, focus management, touch targets (44px min)
- [x] No secrets/tokens in code
- [x] `./scripts/minimal_quality_gate.sh` passes

---

## Risk Assessment
- **Low risk:** #484, #485, #487, #488 (already implemented, verified)
- **Medium risk:** #489, #493, #492 (token/security changes — low blast radius)
- **High risk:** #494, #495, #496 (major UI changes — mitigated by 265 passing tests)

---

## Follow-up Actions
- [ ] E2E test responsive navigation at 375px, 768px, 1280px, 1920px
- [ ] Monitor CSP violations after first deploy
- [ ] Configure `VITE_TELEMETRY_ENDPOINT` in Cloudflare Pages env
- [ ] Close all 12 issues on GitHub after PR merge
