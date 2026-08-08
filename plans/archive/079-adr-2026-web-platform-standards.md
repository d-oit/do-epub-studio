# ADR 079 — 2026 Web Platform Standards Adoption

**Date:** 2026-06-11
**Status:** Accepted
**Supersedes:** ADR-063 (accessibility design tokens)

---

## Context

18 open issues (#480–#497) require coordinated adoption of 2026 web platform
standards. This ADR codifies the technical decisions for design tokens,
responsive layout, accessibility, security, i18n, logging, and agentic workflow.

## Decisions

### 1. Colors: OKLCH Everywhere

- All color primitives defined in `oklch(L C H)` notation
- Derived states via `color-mix(in oklch, ...)` or relative syntax
- Progressive enhancement: `contrast-color()` with `@supports` fallback
- Rationale: perceptually uniform lightness enables reliable WCAG contrast,
  wide-gamut P3 support for modern displays

### 2. Typography: Fluid clamp() Scale

- `clamp(min, preferred, max)` — preferred uses `rem + vi`
- No fixed breakpoints for font sizes
- T-shirt naming: `--text-xs` through `--text-2xl`
- Never hardcode `1rem = 16px` — respect user defaults
- Font stack: Cabinet Grotesk (display) + Satoshi (UI) + Source Serif 4 (reader)

### 3. Spacing: Fluid + 4px Base Grid

- T-shirt naming: `--space-1` (4px) through `--space-24` (96px)
- Larger gaps use `clamp()` for viewport-responsive spacing
- All margins, paddings, gaps reference tokens only

### 4. Layout: CSS Grid + dvh + Container Queries

- App shell: `display: grid; height: 100dvh`
- Single scroll region (only `<main>` scrolls)
- Component-level responsiveness via `@container` queries
- Safe area: `env(safe-area-inset-*)` on all fixed elements
- Navigation: bottom tab bar (<768px), rail (768–1023px), sidebar (≥1024px)

### 5. Dark Mode: data-theme + System Preference

- `data-theme="light|dark"` attribute on `<html>`
- Respect `prefers-color-scheme` when no explicit preference
- FOUC prevention: inline `<script>` in `<head>` reads preference
- Preference stored in cookie (not localStorage) for edge compatibility
- All semantic tokens have light/dark variants

### 6. Accessibility: WCAG 2.2 Level AA

- 4.5:1 contrast ratio for text; 3:1 for large text and UI components
- Minimum 24px touch targets (44px recommended)
- Focus indicators: 3px outline, 3:1 contrast, never obscured (SC 2.4.11)
- `prefers-reduced-motion`: blanket disable + `forced-colors` fallbacks
- Accessible authentication (SC 3.3.8): support paste, password managers
- `autocomplete` attributes on all form inputs
- Skip link targets `<main tabindex="-1">`

### 7. View Transitions

- Enable cross-document transitions via `@view-transition { navigation: auto; }`
- SPA transitions via `document.startViewTransition()` + React Router
- Always pair with `prefers-reduced-motion` suppression
- Progressive enhancement — feature-detect before use

### 8. i18n: Cookie + Intl API

- Locale stored in `do-epub-locale` cookie (1yr, SameSite=Lax, Secure)
- Detection chain: cookie → `navigator.language` → `'en'`
- `document.documentElement.lang` + `dir` updated on change
- All dates/numbers via `Intl` APIs (no moment/date-fns for formatting)
- Typed translation keys (compile-time safety)
- RTL infrastructure present even without active RTL locale

### 9. Error Handling: Structured + Typed + i18n

- Typed `ErrorCode` enum with `toUserMessage(t)` method
- Global boundary: graceful full-page error with retry action
- `unhandledrejection` + `error` window listeners in production
- Toast stack: `role="alert"` for errors, `aria-live="polite"` for info
- No raw codes/stack traces exposed to users
- Error messages use i18n keys exclusively

### 10. Logging: Structured + Privacy-Preserving

- `Logger` interface: debug/info/warn/error + `withTrace(traceId)`
- Console logger (dev), remote logger (prod — `navigator.sendBeacon()`)
- `X-Trace-Id` header on all outbound fetch requests
- `crypto.randomUUID()` per navigation session
- NEVER log PII (email, password, tokens)
- Log level configurable via `VITE_LOG_LEVEL`

### 11. Security: OWASP 2025 + Cloudflare Edge

- CSP: `default-src 'self'`, strict font/connect sources
- Cookies: `HttpOnly; Secure; SameSite=Strict` for auth
- Tokens: in-memory only (never localStorage/sessionStorage)
- DOMPurify for all EPUB metadata rendering
- Rate-limit feedback: inline countdown on HTTP 429
- CI: `pnpm audit --audit-level=high` + gitleaks scan
- Headers: X-Frame-Options DENY, X-Content-Type-Options nosniff

### 12. Agent Skills: Progressive Disclosure Architecture

- AGENTS.md stays ≤150 lines (Tier 1 — always loaded)
- Skills load on-demand via `.agents/skills/[name]/SKILL.md`
- Each skill: name + description (50 tokens) until triggered
- Critical skills updated: design-tokens, anti-ai-slop, security-code-auditor
- Token-efficient patterns: imperative tone, no tutorials, linters over instructions

## Consequences

- All hex colors in `globals.css` must be migrated to OKLCH
- Components using hardcoded px/rem must switch to token references
- Login page requires full rebuild per new component architecture
- `localStorage` usage for auth/locale must be replaced with cookies
- Agent skill files grow by ~5 files but context usage stays flat (on-demand loading)
- View Transitions require testing across browsers (Firefox support monitor)

## Compliance

- Verified against AGENTS.md Tier 1 rules (no secrets, semantic tokens, traceId)
- Verified against AGENTS.md Tier 3 (OKLCH, View Transitions, mutual exclusivity)
- No hardcoded dates (all use environment `date`)
