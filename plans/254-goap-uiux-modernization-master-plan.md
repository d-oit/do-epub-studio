# GOAP-254: UI/UX & Concept Modernization Master Plan

**Status:** IN PROGRESS
**Date:** 2026-08-23
**Strategy:** Hybrid — sequential solo execution (subagent provider weekly quota exhausted 2026-08-23, resets ~2026-08-24; swarm fan-out deferred to next session)
**Related:** ADR-082b (editorial minimalist), ADR-105a (2026 UI platform), ADR-063a (OKLCH tokens), ADR-104 (product identity), DESIGN.md, PRODUCT.md

## Context

1. **Reference repo available (corrected 2026-08-23).** `github.com/d-oit/epub-sparkle`
   was previously unresolvable (404; see ADR-253 §Context item 4) but is now live and
   owner-directed as THE UI/UX reference for this modernization. Execution anchored to
   it: see `plans/255-goap-epub-sparkle-uiux-port.md` (W3 below is superseded there by
   a concrete editorial-alignment pass). This repo's ratified standards (DESIGN.md,
   PRODUCT.md, ADR-082b/105a/111) remain the constraint frame.
2. **Directive scope:** keep Cloudflare DB and infrastructure as-is; modernize UI/UX
   and product concept only.
3. **Plans/ hygiene restored (same session):** 21 completed GOAP execution records
   moved to `plans/archive/`; root now holds only accepted-era ADRs, the active
   GOAP-247 record, and `ADR-INDEX.md` (validated by `scripts/check-adr-index.mjs`,
   markdownlint clean).

## Ground truth (verified 2026-08-23)

The stack is already at 2026 standards. Modernization must NOT re-do these:

| Surface | Evidence |
| --- | --- |
| React 19 + `useOptimistic`/`useActionState`/`useFormStatus` | `apps/web/src/features/reader/hooks/useOptimisticAnnotations.ts`, `features/auth/LoginPage.tsx`, `features/admin/GrantsPage.tsx` |
| View Transitions with graceful degradation + prevent-flicker | `apps/web/src/components/ViewTransitionRoutes.tsx`, `globals.css:505-509` |
| Native Popover API with JS fallback | `packages/ui/src/tooltip.tsx`, `features/reader/components/annotations/AnnotationToolbar.tsx`, `globals.css:400-437` |
| Container queries (named, test-enforced ≥5 rules) | `globals.css:443-488`, `apps/web/src/__tests__/design-tokens.test.ts:55-61` |
| Pure OKLCH semantic tokens, light/dark/sepia themes, zero hardcoded hex outside tokens | `globals.css:24+150+191` (214 custom props); hex grep outside tokens = 0 |
| Router v7.18.2 (lazy routes + guards) | `apps/web/package.json`, `App.tsx:119-175` |
| Vite 8 / Tailwind 4 / TS 6 / Vitest 4 / Turborepo 2.9 / pnpm 10 | root + `apps/web/package.json` |
| CF infra coherent: D1 migrations owned by `packages/schema` (0001-0012), Pages Functions same-origin API (`apps/web/functions/api/[[path]].ts`) | `apps/worker/wrangler.jsonc:31-33`, GOAP-252 |

## Waves

### W1 — Docs & context drift closure (this session)
Repo guidance contradicts reality and would steer agents into regressions:
- `.agents/AGENTS.md` version table lists React 18.x / TS 5.4+ / Vitest 1.x→2.x /
  Vite 6.x / Workbox rows — all superseded by the shipped stack above.
- `.agents/AGENTS.md` known-warning "React Router future flags (v7 upgrade
  pending)" is obsolete: router is already v7.18.2.
- `README.md` architecture tree omits `packages/ui` (and `testkit`).

**Acceptance:** AGENTS.md tables match installed versions; README tree complete;
no new claims without file evidence.

### W2 — Accessibility 2.2 AA elevation
ADR-063a targets WCAG 2.1 AA. Elevate target to 2.2 AA (focus-not-obscured,
target-size minimum, drag alternatives) using the accessibility-auditor skill;
produce gap list keyed to components, then fix.

**Quality gate:** axe-core suite green; auditor report filed under `analysis/`.

### W3 — Editorial-minimalist consistency pass (reader-first)
Run Impeccable critique/polish across reader, catalog, library, admin surfaces;
align empty states, loading skeletons, and motion with DESIGN.md anti-pattern
list. No new dependencies; tokens only.

**Quality gate:** `npx impeccable detect --json .` unchanged-or-better; visual
verification on real pages.

### W4 — Offline/PWA UX surfacing
Sync-queue state, offline indicator, install affordance surfaced consistently
(PRODUCT.md core flow 5) without touching worker API contracts.

**Quality gate:** E2E smoke (`pnpm test:e2e:smoke`) green.

## Constraints

- DO NOT MODIFY: `apps/worker/**` route handlers/contracts, `packages/schema`
  migrations, wrangler bindings, deploy workflows (infra keep-set).
- STABLE CONTRACT: `packages/shared` DTOs + `packages/schema` Zod schemas as
  consumed by web.
- Every wave lands behind existing quality gates (`pnpm verify`).

## Synthesis

Waves are sequential by dependency (docs → a11y baseline → visual → offline),
but within W3/W4 individual surface fixes parallelize once agent capacity
returns (resume swarm per goap-agent skill Phase 6).
