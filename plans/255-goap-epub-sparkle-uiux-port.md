# GOAP-255: epub-sparkle UI/UX Port — Editorial Alignment

**Status:** IN PROGRESS (W1 executing)
**Date:** 2026-08-23
**Strategy:** Swarm (task-tier agents; scout tier quota-exhausted 2026-08-23) — 3 parallel implementation tasks + solo orchestration/integration
**Orchestrates:** GOAP-254 W3 (editorial-minimalist consistency pass), now anchored to a live reference
**Reference:** `github.com/d-oit/epub-sparkle` (local: `/home/doit/git/epub-sparkle`) — TanStack Start app, branch `feat/w1-cf-scaffold` (PR #2 open)

## Context correction to GOAP-254

GOAP-254 §Context item 1 recorded the reference repo as unavailable. That is no longer
true: the repo resolves and is actively developed by the owner. Per owner directive
(2026-08-23), epub-sparkle IS the UI/UX source of truth for this codebase's
modernization. Its ratified standards (DESIGN.md, PRODUCT.md, ADR-063a/105a) remain
the *constraint frame*; epub-sparkle supplies the *design language and UX patterns*.

## Reference design language (verified from `epub-sparkle/src/styles.css`, routes)

- **Palette "paper / ink / ember"**: warm paper background (`oklch(0.976 0.011 84)`),
  ink foreground (`oklch(0.22 0.02 62)`), ember brand accent (`oklch(0.55 0.15 52)`),
  paper-edge borders, all OKLCH with light/dark pairs.
- **Texture & depth**: `paper-grain` radial-dot utility, `shadow-page` / `shadow-spine`
  book-object shadows, hairline `rounded-sm` geometry (`--radius: 0.35rem`).
- **Typographic system**: serif display headings w/ tight leading
  (`text-balance-tight`), mono uppercase tracked micro-labels ("eyebrow") for meta
  rows, muted-foreground ledes.
- **UX patterns**: editorial landing (eyebrow → serif H1 → lede → CTA pair → feature
  grid); split-screen auth; library as horizontal book cards (2:3 cover, progress
  underline bar, tag badges, mono meta row, hover-revealed actions); calm empty states.

## Deliberate divergences (constraints win over reference)

| Divergence | Reason |
| --- | --- |
| Keep Geist + Instrument Serif pairing | Committed per Plan 115 U4 / DESIGN.md Typography |
| Keep 13-locale i18n coverage for every new string | ADR i18n coverage; `TranslationKeys` typing |
| Keep canonical identity strings/routes | ADR-104 pins (`check-app-identity.mjs`, `app-routes.test.tsx`) |
| Keep token architecture (layers, container names, p3 block, sepia theme) | `design-tokens.test.ts` contract + ADR-105a |
| Brand accent blue → ember, warm paper neutrals | Owner directive; test expectations updated deliberately in same PR |

## Waves

### W1 — Editorial alignment pass (this PR)

Parallel task decomposition (file ownership disjoint):

| Task | Files owned | Contract |
| --- | --- | --- |
| T1 tokens+utilities | `apps/web/src/styles/globals.css`, `apps/web/src/__tests__/design-tokens.test.ts` | Introduce `--paper/--ink/--ember` derived values into existing semantic tokens across light/dark/sepia (+p3); add `.eyebrow`, `.text-balance-tight`, `.paper-grain`, `--shadow-page/spine`; keep all 8 container names, layers, ≥5 `@container` rules, oklch-only |
| T2 login split-screen | `apps/web/src/features/auth/LoginPage.tsx` + `LoginHero.tsx`/`LoginMobileInfo.tsx`, `i18n/en.ts` + 12 locales | lg:`grid-cols-[1.1fr_1fr]` hero left / form right; eyebrow = `APP_NAME`, serif headline via new ≤4 i18n keys; keep `useActionState` flow, demo block, recovery views, identity strings intact |
| T3 library cards | `apps/web/src/features/library/**` presentational components only | Horizontal BookCard pattern (cover 2:3 + progress underline, title/author, mono meta row, hover action row); reuse existing `library.*` i18n keys; data layer (buckets, infinite scroll) untouched |

Integration owner: orchestrator (branch `feat/goap-255-sparkle-uiux`).

**Quality gates (all must pass before PR):**
1. `pnpm typecheck` exit 0
2. `pnpm lint` exit 0
3. `pnpm test:unit` — design-tokens, app-identity-parity, app-routes, main, books-page suites green
4. `pnpm build` exit 0 AND `pnpm bundle:budget:enforce` within budget (mainCss 30KB gz)
5. Browser visual verification: `/login` + `/library` screenshots on dev server

### W2 — deferred (next session, needs route-pin decisions)

Public landing at `/` (currently auth-resolution splash; touches `app-routes.test`
contract), nav consolidation (Sidebar/BottomTabBar orphaned by self-contained pages),
reader chrome alignment, upload/share/admin surface parity.

## Non-goals

No worker/schema/wrangler changes (GOAP-254 keep-set). No new runtime deps. No font
changes. Reader internals untouched in W1.
