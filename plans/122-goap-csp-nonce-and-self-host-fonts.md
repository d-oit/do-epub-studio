# GOAP 122 — CSP `style-src-attr` strategy + Self-Hosted Fonts (SE2 + SE3)

**Date:** 2026-07-09
**Status:** 🔄 ACTIVE — branch `security/csp-style-src-attr-and-self-host-fonts`
**Author:** Buffy execution session
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Extends:** Plan 116 § SE2 + SE3, Plan 121 § P3 Backlog, ADR-035

---

## Goal

Remove `style-src 'unsafe-inline'` and all external font origins from
the Content-Security-Policy on both Cloudflare Pages (web) and the
Cloudflare Worker (API), self-hosting Geist and Instrument Serif
without regressing React/Vite/Tailwind v4 behavior or Lighthouse
performance.

Resolves Plan 116 items **SE2** (CSP `style-src 'unsafe-inline'`) and
**SE3** (external font origins in CSP).

---

## Analyze

### Current state (from Plan 116 § SE2/SE3)

| Surface | Directive | Current value |
|---------|-----------|---------------|
| `apps/web/public/_headers` | `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` |
| `apps/web/public/_headers` | `font-src` | `'self' https://fonts.gstatic.com https://api.fontshare.com` |
| `apps/web/public/_headers` | `script-src` | `'self' 'wasm-unsafe-eval'` (already strict; no change) |
| `apps/worker/src/lib/security-headers.ts` | `style-src` | `'self' 'unsafe-inline'` |
| `apps/web/index.html` | font load | `<link href="https://fonts.googleapis.com/css2?family=Geist…&family=Instrument+Serif…">` |

### Why the gap exists

- Cloudflare Pages serves `index.html` directly; the static
  `_headers` file cannot inject a per-request nonce. A nonce strategy
  would require proxying HTML through a Worker or Pages Function,
  adding latency and complexity.
- SHA-256 hashing of inline `<style>` blocks is fragile because
  Vite/Tailwind v4 injection points depend on build internals.
- React 19 + libraries insert **inline style attributes** such as
  `style={{width:'${pct}%'}}` on 19+ sites — these are governed by
  `style-src-attr`, not the legacy `style-src`.

### Why this matters

A malicious EPUB or XSS payload that lands inline JS in the page
cannot exfiltrate via `<style>` tags once `style-src 'unsafe-inline'`
is removed — the policy is now structurally resistant to that
class of attack. External font origins additionally leak visitor IP
addresses to Google/Fontshare on every page load and create a third-
party dependency for normal browsing.

---

## Decompose

| # | Component | Atomic | Shippable |
|---|-----------|--------|-----------|
| 1 | Install `@fontsource-variable/geist` + `@fontsource/instrument-serif` | yes | yes |
| 2 | Import self-hosted fonts in `apps/web/src/styles/globals.css` | yes | yes |
| 3 | Remove external `<link>` from `apps/web/index.html` | yes | yes |
| 4 | Tighten `apps/web/public/_headers` (`style-src-attr`, drop origins) | yes | yes |
| 5 | Tighten `apps/worker/src/lib/security-headers.ts` (drop unsafe-inline) | yes | yes |
| 6 | Update `docs/security-posture.md` (CSP table + explanatory paragraph) | yes | yes |
| 7 | Add test assertions (web `security-posture.test.ts`, worker `security-headers.test.ts`) | yes | yes |
| 8 | Run quality gate (typecheck + lint + unit tests) | yes | yes |
| 9 | Validate Codacy + bundle budget + HSTS/CSP smoke test | yes | yes |
| 10 | Open PR (no auto-merge) | yes | yes |

Dependencies: 1 → 2 → 3 → 4 → 5; 4 + 5 → 6; 4 + 5 → 7; 1–7 → 8 → 9 → 10.

---

## Strategize

### CSP strategy: `style-src-attr 'unsafe-inline'`

CSP Level 3 separates the two style sources:

- `style-src` governs `<style>` *elements* and external stylesheets
  (`<link rel="stylesheet">`). Strict: `'self'`.
- `style-src-attr` governs inline `style="…"` *attributes* on DOM
  nodes (React's `style={{ ... }}` props land here). Permitted:
  `'unsafe-inline'` because there is no static hash-set and Pages
  cannot dynamically nonce each request.

This preserves React 19 + Vite + Tailwind v4 + View Transitions
functionality while structurally blocking attacker-injected
`<style>` blocks (the dominant XSS style-vector for hostile EPUBs).

### Font self-hosting strategy: `@fontsource` packages

Compare to alternatives:

1. **Manual `.woff2` files in `apps/web/public/fonts/`** — requires
   manual download, fixed filenames collide with Vite's cache-busting
   strategy.
2. **`@fontsource-variable/geist` + `@fontsource/instrument-serif`** —
   pnpm-managed, Vite-bundled, hashed asset URLs, license-clean
   (SIL OFL 1.1 for both families).
3. **`unplugin-fonts` / fontsource-bundler build-time generation** —
   too much overhead for two families.

Chosen: **option 2**. We import:
- `@fontsource-variable/geist` (one CSS file, Latin subset, weight
  axis 100-900 — sufficient for `Geist` weights 300..700)
- `@fontsource/instrument-serif/400.css` (regular)
- `@fontsource/instrument-serif/400-italic.css` (italic)

Skipping the 700-italic reduces payload by ~25 KB. Skipping `all.css`
keeps the bundle to Latin-ext subset only.

### Compatibility constraints

- **Vite build**: `@import` declarations in `globals.css` are extracted
  to a single bundled CSS file. Font assets are processed by Vite's
  asset pipeline and get content-hashed URLs.
- **Vite dev**: `@vitejs/plugin-react` HMR injects `<style>` tags, but
  Vite's dev server does **not** apply Cloudflare `_headers`. Dev mode
  works regardless of the strict `style-src`.
- **Cloudflare Pages preview/production**: only production builds are
  served; the strict `style-src 'self'` is correct.
- **Tailwind v4 `@theme { ... }` block**: references `--font-display`
  custom property defined at `:root`. No invasive change needed.

### Test additions

- `apps/web/src/__tests__/security-posture.test.ts`:
  - Parse `style-src` tokens → assert no `'unsafe-inline'`, no
    Google Fonts origin.
  - Parse `style-src-attr` → contains `'unsafe-inline'`.
  - Parse `font-src` → contains only `'self'`.
  - New test: `index.html` has no `fonts.googleapis.com` /
    `fonts.gstatic.com`. `globals.css` imports both `@fontsource`
    packages.
- `apps/worker/src/__tests__/security-headers.test.ts`:
  - `securityHeaders['Content-Security-Policy']` contains neither
    `'unsafe-inline'` nor `'unsafe-eval'` anywhere.
  - `style-src` directive includes `'self'`.

### Bundle impact

| Asset | Approx. size |
|-------|-------------|
| Geist variable (wght 100–900, Latin) | ~50 KB woff2 |
| Instrument Serif 400 | ~22 KB woff2 |
| Instrument Serif 400-italic | ~24 KB woff2 |
| `@fontsource` CSS overhead | ~3 KB |
| **Total** | **~99 KB** |

Compared to Google Fonts: ~140 KB uncompressed + 2 RTTs to Google.
Self-hosting wins on LCP (no DNS/TCP/TLS to third party) while
adding ~99 KB to the initial bundle (manageable within the 1.15 MB
reader bundle budget per Plan 121).

---

## Coordinate

| Agent | Task |
|-------|------|
| file-picker | Locate all inline `style={…}` style usages (19 found) |
| code-searcher | Search for Google Fonts references + unsafe-inline variants |
| basher | Install pnpm packages; create branch; run typecheck/lint/test |
| researcher-docs (Gemini) | CSP Level 3 nonce-vs-attribute rationale |
| code-reviewer-minimax-m3 | Final review pass on the PR |

---

## Execute — File-by-File Change List

1. `apps/web/package.json` — add `@fontsource-variable/geist@^5.2.9`
   and `@fontsource/instrument-serif@^5.2.8`.
2. `apps/web/src/styles/globals.css` — prepend 3 `@import` lines
   (commented with ADR-123 rationale).
3. `apps/web/index.html` — remove the `<link>` + `<preconnect>` for
   Google Fonts; replace with a comment.
4. `apps/web/public/_headers` — change CSP:
   - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
     → `style-src 'self'`
   - Add `style-src-attr 'unsafe-inline'`
   - `font-src 'self' https://fonts.gstatic.com https://api.fontshare.com`
     → `font-src 'self'`
5. `apps/worker/src/lib/security-headers.ts` — change CSP:
   - `style-src 'self' 'unsafe-inline'` → `style-src 'self'`
   - Updated inline comment explaining API doesn't need 'unsafe-inline'.
6. `docs/security-posture.md` — update CSP table + the
   "only unsafe-inline is in style-src" paragraph.
7. `apps/web/src/__tests__/security-posture.test.ts` — extend
   assertions + new font self-host test (preserves existing
   client-logger test).
8. `apps/worker/src/__tests__/security-headers.test.ts` — add CSP
   assertion tests.

---

## Synthesize — Rollout Risk + Rollback

### Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FOUT / CLS regression | Low | Geist woff2 imports are tiny; `font-display: swap` is default |
| Bundle budget exceed | Low | Combined ~99 KB fits within 1.15 MB reader budget |
| Vite HMR dev errors | None | Dev server ignores `_headers` strict CSP |
| External CDN removal breaks login | None | Fonts are bundled, not loaded externally |
| Dev tools / DevTools inline styles | None | Only enforced in prod at Pages edge |

### Rollback

Revert the PR (single revert) restores the old `_headers` and worker
CSP. The `@fontsource` packages can remain in `package.json` without
harm; they only contribute bytes if their CSS is imported, so removing
the imports in `globals.css` immediately stops loading the fonts.

### Verification checklist (manual)

- [ ] `curl -I https://<staging>/index.html` returns CSP without
      `unsafe-inline` in `style-src` (only in `style-src-attr`).
- [ ] `curl https://<staging>/styles.css` returns the bundled CSS
      under the same origin (not Google).
- [ ] Lighthouse mobile score ≥ current on `/` and `/reader`.
- [ ] Bundle budget script passes.
- [ ] Codacy gate green.
- [ ] Smoke e2e (login, upload, reader) passes.
