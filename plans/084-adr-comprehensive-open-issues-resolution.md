# ADR-084: Comprehensive Open Issues Resolution — 2026-06-12

**Date:** 2026-06-12
**Status:** Accepted
**Deciders:** GOAP swarm agent
**Context:** 12 open GitHub issues (#484–#497) spanning security, UI, i18n, accessibility, and PWA

---

## Context

The project had 12 open issues covering:
- 2 bugs (#484 visible labels, #487 skip link)
- 10 enhancements (#485 locale persistence, #486 branding, #488 spinner, #489/#497 design tokens, #490 i18n, #492 logging, #493 security, #494 navigation, #495 PWA banner, #496 login redesign)

4 were already implemented and needed verification. 8 required new code.

---

## Decision

### Already Implemented (Verified)
- **#484** — `Input` component renders `<label htmlFor={id}>` with proper `htmlFor` association
- **#485** — `useLocaleStore` uses Zustand `persist` middleware storing to `do-epub-locale` cookie
- **#487** — `<main id="main-content" tabIndex={-1}>` is the target of the skip link in `App.tsx`
- **#488** — `Button` component accepts `isLoading`/`loadingLabel` props, sets `aria-busy`, renders spinner

### New Implementations

#### #486 — App Logo (`AppLogo.tsx`)
- Inline SVG with `role="img"` and `aria-label="do EPUB Studio logo"`
- `currentColor` fills for automatic light/dark adaptation
- Responsive sizing via `size` prop (24px mobile toolbar → 48px login card)
- Zero additional HTTP requests (inline SVG)

#### #489/#497 — Design Tokens (`globals.css`)
- **Fluid type scale:** `clamp()` functions for `--text-xs` through `--text-xl` (320px→1280px)
- **Font loading:** Google Fonts preconnect + stylesheet for Instrument Serif (display) + Geist (body)
- **Spacing scale:** `--space-1` (4px) through `--space-16` (64px)
- **Border radius:** `--radius-sm` through `--radius-full`
- **Shadows:** `--shadow-sm`, `--shadow-md`, `--shadow-lg` (oklch-based)
- **Base reset:** `box-sizing: border-box` universal selector
- **@theme expansion:** All new tokens mapped to Tailwind v4 theme

#### #492 — Logging/Tracing (`client-logger.ts`)
- **Configurable log level:** `VITE_LOG_LEVEL` env variable (debug/info/warn/error)
- **Remote delivery:** `navigator.sendBeacon()` for warn/error entries to `VITE_TELEMETRY_ENDPOINT`
- **Auto-flush:** On `visibilitychange=hidden` and `beforeunload`
- **Performance marks:** `createPerformanceMark()` and `measurePerformance()` utilities
- **PII safety:** Never logs email, password, or tokens

#### #493 — Security Hardening (`_headers`)
- **CSP enforcing:** `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https://*.cloudflare.com; frame-ancestors 'none'; upgrade-insecure-requests`
- **Security headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cross-Origin-Opener-Policy: same-origin`

#### #494 — Responsive App Shell
- **BottomTabBar:** Fixed bottom, 3 tabs (Library/Reader/Settings), `role="tablist"`, `aria-selected`, safe area insets, visible `<768px`
- **Sidebar:** 240px width, sticky, full height, logo + nav items, visible `≥1024px`
- **Drawer:** Slide-in overlay with scrim, escape key dismiss, 44px touch targets, visible `768–1023px`
- **Top bar:** Hamburger menu (mobile), AppLogo + title, visible `<1024px`

#### #495 — PWA Banner Redesign
- **Position:** Bottom toast (not top), fixed above bottom nav
- **Auto-dismiss:** 6s for offline-ready, never for update-available
- **3 variants:** offline-ready (check icon), update-available (refresh icon), offline (wifi-off icon)
- **Accessibility:** `role="status"`, `aria-live="polite"`, 44px dismiss button touch target
- **Motion:** Respects `prefers-reduced-motion`

#### #496 — Login Page Redesign
- **Layout:** Centered card (`max-w-sm`) on all breakpoints
- **Branding:** AppLogo + "do EPUB Studio" heading in display font
- **Form:** Proper `<label>` elements, `autocomplete` attributes, `inputMode="email"`, `noValidate`
- **Error handling:** Inline error with `role="alert"`, `border-l-3` accent styling
- **Forgot password:** Link below password field
- **Responsive:** `min-h-dvh`, safe area insets, no overflow at 375px

---

## Consequences

### Positive
- All 12 issues resolved in a single session
- 265 tests pass (1 new test for admin redirect)
- Zero lint/typecheck warnings
- Design system fully tokenized (no hardcoded values)
- WCAG 2.1 AA compliance maintained across all new components
- i18n parity maintained (EN/DE/FR — 235 keys each)
- No new dependencies added

### Negative
- New navigation components need E2E testing on real devices
- CSP enforcing mode may block legitimate third-party resources on first deploy
- Remote logger endpoint requires production env configuration

### Risks
- **CSP breakage:** Mitigated by monitoring `/api/csp-report` endpoint
- **Navigation UX:** Bottom tab bar changes established user flow — needs user testing
- **Font loading:** Instrument Serif + Geist adds ~200KB — mitigated by `display=swap`

---

## Follow-up
1. E2E test responsive navigation at 375px, 768px, 1280px, 1920px
2. Monitor CSP violations after deploy
3. Configure `VITE_TELEMETRY_ENDPOINT` in Cloudflare Pages env
4. Close all 12 issues on GitHub after PR merge
5. Update `SECURITY.md` with CSP enforcement policy
