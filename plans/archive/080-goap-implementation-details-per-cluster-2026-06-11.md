# GOAP Plan 080 — Implementation Details per Issue Cluster

**Date:** 2026-06-11
**Parent:** 079-goap-open-issues-2026-best-practices
**Purpose:** Atomic task breakdown for agent execution

---

## Cluster A: Design Token System (#489, #497)

### Pre-conditions
- Read existing `apps/web/src/styles/globals.css`
- Read existing `packages/ui/.storybook/preview.css`
- Verify font availability (Cabinet Grotesk, Satoshi, Source Serif 4)

### Atomic Tasks

```
A1. Create packages/ui/src/styles/tokens.css
    - Primitive layer: OKLCH color palette (warm neutrals + teal primary)
    - Fluid type scale: --text-xs through --text-2xl via clamp()
    - Spacing scale: --space-1 through --space-24 (4px base)
    - Radius, shadows (OKLCH alpha), transitions, z-index, content widths
    - [data-theme="dark"] overrides
    - @media (prefers-color-scheme: dark) fallback

A2. Create packages/ui/src/styles/base.css
    - box-sizing: border-box global reset
    - body: min-height 100dvh, font-family var(--font-body)
    - focus-visible: 3px outline with --color-primary
    - prefers-reduced-motion: blanket disable
    - forced-colors: border fallbacks for shadows
    - .sr-only utility class

A3. Migrate apps/web/src/styles/globals.css
    - Replace all hsl() values with OKLCH references
    - Map existing --foreground/--background to new semantic names
    - Ensure backward compatibility (alias old names)
    - Verify Tailwind 4 @theme compatibility

A4. Update apps/web/index.html
    - Add font preconnect + stylesheet links
    - Add inline <script> for FOUC prevention:
      reads do-epub-theme cookie → sets data-theme before paint

A5. Create .agents/skills/design-tokens/SKILL.md
    - ALWAYS rules: token references, both themes, font usage
    - NEVER rules: hardcoded hex, px font sizes, purple gradients
    - Quick reference table of all token categories

A6. Update .agents/skills/anti-ai-slop/SKILL.md
    - Expanded pattern blacklist (10 items)
    - Approved patterns list
    - Audit checklist for UI review
```

### Validation
- `./scripts/quality_gate.sh` passes
- No hardcoded hex remaining in component files
- Both themes verified at WCAG AA contrast
- Storybook renders with new tokens

---

## Cluster B: i18n Infrastructure (#490, #485)

### Atomic Tasks

```
B1. Update apps/web/src/stores/locale.ts
    - Read from cookie: document.cookie.match(/do-epub-locale=([^;]+)/)
    - Fallback: navigator.language.split('-')[0]
    - Default: 'en'
    - On change: set cookie (1yr, SameSite=Lax, Secure, path=/)
    - On change: set document.documentElement.lang
    - On change: set document.documentElement.dir (rtl/ltr)

B2. Create apps/web/src/i18n/types.ts
    - Generate union type from en.ts keys
    - Export TranslationKey type for compile-time safety
    - Update useTranslation hook to accept TranslationKey

B3. Create apps/web/src/utils/format.ts
    - fmt.date(d, locale) → Intl.DateTimeFormat
    - fmt.number(n, locale) → Intl.NumberFormat
    - fmt.relativeTime(d, locale) → Intl.RelativeTimeFormat

B4. Complete translation coverage
    - Audit en.ts, de.ts, fr.ts for missing keys
    - Add: auth.forgot_password, pwa.update_available, pwa.offline_mode
    - Add: nav.library, nav.reader, nav.settings
    - Add: errors.rate_limited, errors.network_offline, errors.session_expired
    - Add: a11y.switch_to_dark, a11y.switch_to_light, a11y.close

B5. Add E2E test for locale persistence
    - Select Deutsch → reload → verify Deutsch still selected
    - Verify cookie is set with correct attributes
```

---

## Cluster C: Error Handling (#491)

### Atomic Tasks

```
C1. Enhance packages/shared/src/errors.ts
    - Add ErrorCode union type (AUTH_*, NETWORK_*, EPUB_*, STORAGE_*, UNKNOWN)
    - Add toUserMessage(t: (key: string) => string): string
    - Add context field for structured metadata
    - Export error factory functions

C2. Enhance apps/web/src/components/ErrorBoundary.tsx
    - Full-page error state: icon + heading + description + retry + home link
    - Use design tokens for styling
    - Log error to logger (no stack in production)
    - All text via i18n keys

C3. Add global handlers to apps/web/src/main.tsx
    - window.addEventListener('unhandledrejection', ...)
    - window.addEventListener('error', ...)
    - Log via structured logger
    - Show toast for non-fatal errors

C4. Create packages/ui/src/components/ToastStack.tsx
    - Zustand store for toast queue (max 3 visible)
    - 4 types: info, success, warning, error
    - Auto-dismiss: 5s info/success, 8s warning, manual for error
    - Position: bottom-right desktop, bottom-center mobile (above nav)
    - Accessible: role="alert" for error, aria-live="polite" for others

C5. Add error routes to apps/web/src/App.tsx
    - /404 → NotFoundPage (i18n, design tokens, nav back)
    - Catch-all route → NotFoundPage
```

---

## Cluster D: Logging & Tracing (#492)

### Atomic Tasks

```
D1. Create packages/shared/src/logger.ts (interface only)
    - LogLevel, LogEntry, Logger types
    - withTrace(traceId: string): Logger

D2. Create apps/web/src/lib/loggers/console.ts
    - Colored output per level (OKLCH-based colors in dev)
    - Structured format: [timestamp] [level] [traceId] message {context}
    - Silent debug/info in production

D3. Create apps/web/src/lib/loggers/remote.ts
    - Buffer entries in array
    - Flush via navigator.sendBeacon() on:
      - Buffer reaches 10 entries
      - visibilitychange → hidden
      - beforeunload
    - Include: traceId, app version, locale, level, message, context
    - NEVER include: email, password, tokens

D4. Upgrade apps/web/src/main.tsx
    - Generate traceId via crypto.randomUUID()
    - Create logger = createCompositeLogger([console, remote])
    - Monkey-patch fetch to add X-Trace-Id header
    - Performance marks: app:init, login:start/complete, epub:load

D5. Add VITE_LOG_LEVEL to .env files
    - development: debug
    - production: warn
```

---

## Cluster E: Security (#493)

### Atomic Tasks

```
E1. Upgrade apps/web/public/_headers
    - CSP: script-src 'self' 'wasm-unsafe-eval'
    - style-src: 'self' 'unsafe-inline' fonts.googleapis.com
    - font-src: 'self' fonts.gstatic.com api.fontshare.com
    - connect-src: 'self' *.cloudflare.com
    - frame-ancestors: 'none'
    - Add: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
    - Add: Permissions-Policy, Cross-Origin-Opener-Policy

E2. Verify session storage pattern
    - Confirm: no auth tokens in localStorage
    - Confirm: HttpOnly cookies or in-memory module variable
    - If gap exists: refactor to in-memory + cookie pattern

E3. Add CI security jobs to .github/workflows/ci.yml
    - pnpm audit --audit-level=high
    - gitleaks/gitleaks-action@v2
    - Fail on high/critical findings

E4. Update .agents/skills/security-code-auditor/SKILL.md
    - Add CSP verification checklist
    - Add cookie attribute audit
    - Add no-localStorage-for-tokens rule
    - Add autocomplete coverage check
    - Add DOMPurify usage requirement
```

---

## Cluster F: Responsive App Shell (#494)

### Atomic Tasks

```
F1. Create packages/ui/src/components/AppShell.tsx
    - CSS Grid: grid-template-rows: auto 1fr auto
    - height: 100dvh, overflow: hidden (only main scrolls)
    - Render: TopBar + body(Sidebar/Drawer + main) + BottomTabBar
    - Login pages excluded (render outside shell)

F2. Create packages/ui/src/components/BottomTabBar.tsx
    - Visible < 768px only
    - 4 tabs max: Library, Reader, Search, Settings
    - Icons: Lucide 24px, labels --text-xs
    - Active: --color-primary tint
    - role="tablist", each item role="tab" + aria-selected
    - min-height: 56px + env(safe-area-inset-bottom)

F3. Create packages/ui/src/components/TopBar.tsx
    - Sticky, z-index: 100
    - Left: Logo + app name
    - Right: Search, ThemeToggle, LocaleSelect, ProfileAvatar
    - Mobile: hamburger → Drawer
    - Height: 56px mobile, 64px desktop
    - backdrop-filter: blur(12px) saturate(1.2) on scroll

F4. Create packages/ui/src/components/Sidebar.tsx
    - Desktop ≥1024px: 240px persistent sidebar
    - Tablet 768–1023px: hidden (Drawer instead)
    - Sticky, full height, border-right
    - Nav items with aria-current="page"

F5. Create packages/ui/src/components/Drawer.tsx
    - Tablet: slide-in overlay with scrim
    - Triggered by hamburger in TopBar
    - Focus trap when open
    - Dismiss: scrim click, Escape key, close button
    - Animated: translateX with prefers-reduced-motion respect

F6. Wire into apps/web/src/App.tsx
    - Wrap authenticated routes with <AppShell>
    - Auth routes (/login, /reader-login) render standalone
    - scroll-padding-top: 80px on html (sticky header height)
```

---

## Cluster G: PWA Banner (#495)

### Atomic Tasks

```
G1. Create packages/ui/src/components/PwaBanner.tsx
    - Props: type (offline-ready | update-available | offline), onDismiss, onUpdate
    - Fixed bottom, above BottomTabBar: bottom: calc(nav-height + space-4 + safe-area)
    - Width: min(calc(100vw - space-8), 480px), centered
    - role="status", aria-live="polite"
    - Dismiss button: aria-label with full context, min 44px target

G2. Style with design tokens
    - Background: --color-surface-2
    - Border: oklch(from --color-text l c h / 0.12)
    - Text: --color-text (NOT muted — 4.5:1 minimum)
    - Shadow: --shadow-lg
    - Animation: slide-up 200ms (disabled in prefers-reduced-motion)

G3. Implement auto-dismiss logic
    - offline-ready: setTimeout(6000) → dismiss
    - update-available: never auto-dismiss, show "Update" + "Later"
    - offline: auto-dismiss on navigator.onLine event

G4. Replace apps/web/src/components/SwUpdateNotification.tsx
    - Import PwaBanner, connect to SW registration events
    - Remove old raw text implementation
```

---

## Cluster H: Login Fixes (#480–#484, #486–#488)

### Atomic Tasks

```
H1. Fix password label (#481)
    - Change label to "Password"
    - Add helper text: "Leave blank if using magic link" (via i18n key)
    - Update aria-label to match visible label

H2. Style reader login link (#482)
    - Apply --color-text-muted, underline, text-underline-offset: 2px
    - Add tooltip or adjacent text explaining reader vs admin login
    - Ensure focus-visible ring visible

H3. Add proper labels (#484)
    - Wrap text in <label for="email">, <label for="password">
    - Add id to each input matching the for attribute
    - Add autocomplete="email", autocomplete="current-password"
    - Set type="email" on email field

H4. Fix skip link (#487)
    - Move id="main-content" to <main> wrapping the form
    - Add tabindex="-1" to <main>
    - Ensure skip link is first focusable element in DOM
    - Skip link: .sr-only with :focus-visible override to show

H5. Add dark mode toggle (#480)
    - Create ThemeToggle component (sun/moon SVG)
    - Min 44x44px touch target
    - aria-label: "Switch to dark/light mode" (dynamic)
    - Position in toolbar area (top-right, near locale selector)
    - Store preference in do-epub-theme cookie

H6. Add app branding (#486)
    - Create AppLogo component (inline SVG, currentColor fill)
    - aria-label="d.o.EPUB Studio logo", role="img"
    - Responsive: 48px on login, 24px in toolbar
    - Adapts to light/dark via currentColor

H7. Verify loading state (#488)
    - Confirm: button disabled during request
    - Confirm: spinner SVG with aria-hidden="true"
    - Confirm: text changes to "Signing in..." (i18n key)
    - Confirm: respects prefers-reduced-motion
```

---

## Cluster I: Login Redesign (#496)

### Atomic Tasks

```
I1. Rebuild LoginPage.tsx component structure
    - Top utility bar: LocaleSelect + ThemeToggle
    - Auth card: AppLogo + heading + form + reader-link
    - PwaBanner outside card

I2. Create LoginPage.css using design tokens
    - .login-page: min-height 100dvh, grid, --color-bg
    - .login-page__card: max-width 400px, margin auto, surface, shadow
    - .form-field: flex column, proper label/input/error structure
    - .btn-primary: solid --color-primary, no gradient, 44px height
    - .form-error: role="alert", error-highlight background

I3. Responsive verification
    - 375px: full-width card, no overflow
    - 768px: centered card with breathing room
    - 1280px+: centered card, surface background visible

I4. Integration test
    - E2E: submit with invalid credentials → inline error
    - E2E: successful login → redirect
    - Visual regression: all breakpoints
```

---

## Cluster J: Forgot Password (#483)

### Atomic Tasks

```
J1. Add forgot password UI
    - "Forgot password?" link below password field (--text-sm)
    - Click → reveal inline panel (no page navigation)
    - Pre-fill email from main form

J2. Backend endpoint
    - POST /api/auth/reset-password { email }
    - Rate-limited: 3 requests per email per hour
    - Always return 200 (prevent email enumeration)
    - Send reset link email if account exists

J3. Success/error states
    - Success: "Check your email for a reset link"
    - Error: generic "Something went wrong" (never reveal if email exists)
    - All strings via i18n keys
```

---

## Quality Gates Between Phases

| Gate | Check | Blocks |
|------|-------|--------|
| G1 | `./scripts/quality_gate.sh` | Every phase |
| G2 | WCAG contrast audit (axe-core) | Phase 1A, 2G, 3H |
| G3 | Responsive test (375/768/1280/1920) | Phase 2F, 4I |
| G4 | E2E login flow | Phase 3H, 4I |
| G5 | Security headers scan | Phase 1E |
| G6 | i18n parity test | Phase 1B |

---

## Token Economy (Agent Skills)

| Skill | When Loaded | Est. Tokens |
|-------|-------------|-------------|
| design-tokens | Cluster A, F, G, H, I | ~800 |
| anti-ai-slop | Cluster A, I | ~500 |
| accessibility-auditor | Cluster H, I, F | ~600 |
| security-code-auditor | Cluster E, J | ~700 |
| pwa-offline-sync | Cluster G | ~400 |
| reader-ui-ux | Cluster F, I | ~500 |
| goap-agent | Plan creation (this) | ~600 |

Total on-demand budget: ~4,100 tokens (vs ~28,000 if all loaded at once)
Savings: **85% token reduction** via progressive skill loading
