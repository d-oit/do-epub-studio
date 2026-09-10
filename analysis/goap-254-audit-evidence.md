# GOAP-254 Accessibility Audit — Implementation Evidence (2026-09-10)

Branch: `feat/complete-executable-plan-backlog`. Scope: WCAG 2.2 AA target
(DESIGN.md amended from 2.1), 44px project control rule retained (stricter
than SC 2.5.8's 24px minimum — the two numbers are documented as distinct).

## Confirmed behavior defects (fixed in this PR)

1. **Settings groups had no programmatic names** — `SettingRow` rendered a
   `span` with a regex-generated `id` (`label.replace(...)`) and no group
   semantics. Fixed: native `fieldset`/`legend` with `.eyebrow` legend;
   regex ID removed (safe-regex-authoring: translated labels must never feed
   regex ID generation). Seven groups keep localized names; `aria-pressed`
   selection preserved. No radio-role migration (out of scope).
2. **Reader settings groups not announced as groups** — `ReaderSettingsPanel`
   used `div`+`label` (labels not associated to any control). Fixed: native
   `fieldset`/`legend` per group (theme, font size, family, direction,
   writing mode, AI), `.eyebrow block` legends, panel `rounded-xl` →
   `rounded-sm` (keeps `glass-panel`), `max-h-[calc(100dvh-4rem)]` +
   `overflow-y-auto` so the final control scrolls into reach at 812×375 and
   320px. Fixed-layout still hides unsupported typography settings.
3. **Count badges below 4.5:1** — `bg-accent text-white` (~3.6:1) on the
   reader title badge + two overflow-menu count badges. Fixed with existing
   flipped tokens only (`bg-primary-700 text-background`: 8.91 light / 11.23
   dark / 5.09 sepia). NOTE: the specified `dark:` variant pair was NOT used —
   the repo has no `@custom-variant dark`, so `dark:` compiles to
   `prefers-color-scheme` and never fires for the app's `.dark` token flip.
4. **Login inputs rendered 28px (below the 44px project rule)** — latent:
   `packages/ui` Input/Button carry `min-h-11`, but Tailwind only generates
   utilities for candidates found in scanned in-app sources; no `apps/web`
   file used `min-h-11`, so the rule never existed and controls collapsed to
   intrinsic height. This PR's settings/reader `min-h-11` usage generated the
   rule globally (correct 44px everywhere), which grew the login card +43px
   past the 1440×900 geometry guard. Fixed at the element level only:
   login section `py-10` → `lg:py-4`, card `sm:p-7` → `sm:p-6`
   (mobile rhythm unchanged). Geometry guard passes on chromium + webkit
   with all 44px targets intact.
5. **Audit filter labels unbound** — filter inputs had `aria-label` but no
   `id`/`htmlFor` binding. Fixed: `audit-filter-entity-type/entity-id/
   date-from/date-to` ids with matching labels; aria-labels retained.
6. **`.eyebrow` resolved to no font** — utility set `font-family:
   var(--font-mono)` but `--font-mono` was defined nowhere (silent fallback).
   Fixed: token added to `:root` immediately after `--font-display`; no new
   font import. Verified single declaration.

## Resolved findings (verified, no code change needed)

- Reader has no drag-only interactions (previous/next buttons and
  fixed-layout zoom/spread controls already provide native alternatives) —
  SC 2.5.7 needs no work.
- Catalog page already matched the surface contract — preserved, not churned.
- Skip link + single `main#main-content` assertions hold (AppShell owns the
  landmark; verified in Focus of `app-routes` + axe suites).

## Automation evidence (this branch)

- Roadmap: `viewport-regression` + `a11y-advanced` + `accessibility-audit`
  (chromium + firefox): 35 passed, 3 flaky-pass on retry
  (admin-books landmarks, login axe — retry-green, no code change).
- WebKit `login-responsive-controls` + `catalog-admin-flows` +
  `reader-panel-mutual-exclusivity`: 74 passed, 1 failed → fixed per defect
  4 above → re-run green (geometry passes chromium + webkit).
- `cloudflare-login.spec.ts` failures (backend `Failed to fetch` + duplicate
  hero copy strict-mode) reproduce identically on clean `origin/main`
  (control worktree): pre-existing/environmental, not regressions.
- Zero serious/critical axe findings on exercised surfaces. Automation alone
  is not claimed as full WCAG 2.2 AA compliance.

## Unavailable checks (explicitly not covered)

- Manual screen-reader passes (VoiceOver/TalkBack/NVDA) and real-device
  native PWA installation: no assistive technology or OS install UI in this
  environment. PWA lifecycle is proven with synthetic `beforeinstallprompt`/
  `appinstalled` events in jsdom (17 tests) plus a production-preview smoke
  where Chromium offers installability; native OS dialog interaction is
  reported separately, never claimed from synthetic events.
- Sepia token note (pre-existing, out of scope): `--color-surface`
  (oklch 25%) vs `--color-foreground-muted` (38%) ≈ 1.6:1 on sepia cards;
  `.eyebrow` on sepia surface 2.67:1, on `background-secondary` 5.19:1.
