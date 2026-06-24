# GOAP 110 — Missing Implementation & Modern UI: Verified Consolidated Roadmap

**Date:** 2026-06-24
**Status:** 📋 PROPOSED — analysis + execution roadmap only; no application code changed by this plan
**Author:** Codebase analysis session 2026-06-24
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**Related ADR:** `plans/110-adr-completeness-and-ui-consolidation.md`
**Consolidates:** plan 105 (comprehensive audit), plan 105-ui (UI platform modernization), plan 106 (feature completeness), plan 107 (quality/DX)
**Supersedes (as the execution tracker for):** the four OPEN analysis plans above — they remain the detailed evidence record; THIS plan is the single prioritized, **re-verified** roadmap.

## Why this plan exists

Four substantial analysis plans (105, 105-ui, 106, 107) were authored on
2026-06-23. All four are still `OPEN`, they overlap heavily (e.g. annotation
export, catalog pagination, UI primitives, container queries appear in
multiple), and none of them tracks what has actually shipped since. Adding a
sixth raw analysis plan would worsen the backlog sprawl. Instead, this plan:

1. **Re-verifies** every headline finding against live source on 2026-06-24
   (each row below was confirmed by reading the cited `file:line` or by an
   absence search), separating "still missing" from "now done".
2. **Consolidates** the overlapping items into one de-duplicated, dependency-
   ordered execution roadmap with explicit owners (skills).
3. Defers detailed rationale to the source plans to avoid re-litigation.

## Analyze — verification snapshot (2026-06-24)

Baseline: React 19 / Vite 8 / Hono Workers / Turso / R2 / Durable Objects.
Repo health strong (0 files >500 LOC in prod source, 0 TODO/FIXME in prod).

### Shipped since the 2026-06-23 analysis (remove from backlog)

| Item | Source finding | Evidence (2026-06-24) |
|------|----------------|-----------------------|
| Reading-insights compute + UI surface | plan 105 A5 (InfoPanel not wired) | `features/reader/components/info/InfoPanel.tsx:3,74,84,251` now imports `computeInsightSummary` and renders an insights block; commits `ddb243a`, `e5512dc`. **A5 = DONE.** |
| Self-hosted telemetry endpoint | implicit | `apps/worker/src/routes/telemetry.ts` exists; commit `cf3ea08`. |
| Fixed-layout zoom / spread polish | — | commits `05eb886`, `122fdf4`. |

### Still missing — re-verified (keep in backlog)

| ID | Sev | Domain | Evidence (re-checked 2026-06-24) | Finding |
|----|-----|--------|----------------------------------|---------|
| V1 | **P1** | security | `apps/worker/src/routes/admin/grants.ts` PATCH `/grants/:id` writes the UPDATE with **no** `reader_sessions` revoke; only `/grants/:id/revoke` revokes. | **TIER-1 violation** — grant downgrade leaves elevated sessions live. (plan 105 B1) |
| V2 | P1 | feature | `grep recover apps/web/src/App.tsx` → no match; worker endpoints exist (`routes/admin/auth.ts`). | `/admin/recover` web route absent → recovery email link 404s. (plan 105 A1 / plan 106 A) |
| V3 | P1 | feature | `apps/web/src/lib/offline/sync.ts:185-203` — every non-`highlight` annotation POSTs to `/comments`. | Offline bookmark routes to the wrong endpoint. (plan 105 A2) |
| V4 | P1 | feature | `sync.ts` queue types = `progress` + `annotation` only; insights sync bypasses queue (plan 105 A3/A4). | Bookmarks/insights lack first-class offline queue types → silent loss. |
| V5 | P1 | error/obs | `packages/shared/src/errors.ts` (AppError/toApiError) referenced only in its own test; not imported by worker/web prod. No `redact/scrub` module in `apps/worker/src/lib`. | Typed errors unused; no log-redaction layer. (plan 105 C2/D1/D2) |
| V6 | P1 | feature/UI | `packages/ui/src` has button/card/input/modal/toast/tooltip… but **no** Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs. | UI primitives missing; multiple features blocked. (plan 106 D) |
| V7 | P1 | feature | `apps/worker/src/routes/catalog.ts` is 32 lines; no `limit/offset/cursor/search/filter`. | Catalog has no pagination/search/filter. (plan 106 A/B) |
| V8 | P2 | UI/platform | Zero matches for `@container` / `container-type` in `apps/web/src`. | Container queries unused. (plan 105-ui) |
| V9 | P2 | UI/platform | Zero matches for `popover` in `apps/web/src`. | Native Popover API unused (tooltips/menus still JS). (plan 105-ui) |
| V10 | P2 | UI/platform | Zero matches for `useOptimistic` / `useActionState` / `useFormStatus`. | React 19 patterns unused. (plan 105-ui) |
| V11 | P2 | feature | `features/reader/hooks/useExportNotes.ts` exists; no import counterpart; export omits locator/CFI metadata. | Annotation import missing; export not round-trip. (plan 105 A8 / plan 106 C) |
| V12 | P2 | perf | `apps/worker/src/routes/admin/books.ts` buffers uploads via `arrayBuffer()`; `responses.ts` defaults `no-store`, no `caches.default`. | Upload memory spikes; no edge cache. (plan 105 E1/E2) |
| V13 | P3 | security | `packages/shared/src/epub-validator.ts` parses untrusted XML with raw `.match()`; `_headers`/file responses miss HSTS. | ReDoS-policy + header gaps. (plan 105 B2/B3/B5) |

> Detailed sub-findings (D-series logging, E-series perf, F-series lint,
> G-series build, plus A9–A12) are NOT re-listed here; they remain valid in
> plan 105 and plan 107 and are pulled into Phase 3/4 below by reference.

## Decompose & strategize

Strategy: **hybrid** — P1 correctness/security sequential first (some share
files / migrations), then P2 in parallel swarm, then P3 polish. Every task is
independently shippable via its own feature branch + PR, gated by
`./scripts/quality_gate.sh` and Codacy. UI work follows ADR-063a (semantic
tokens), ADR-105 (platform APIs), ADR-106 (component checklist).

### Phase 1 — P1 correctness, security, unblocking primitives (sequential)

| Task | Closes | Skill | Notes |
|------|--------|-------|-------|
| T1 | V1 | `secure-invite-and-access` | Revoke `reader_sessions` inside the grant-PATCH transaction when mode/comments/offline/expiry tighten. Add downgrade-revocation test. **TIER-1.** |
| T2 | V5 | `cloudflare-worker-api` | Adopt shared typed errors in worker routes + central log-redaction scrubber (governed by ADR-105/ADR-067). Redaction unit tests. |
| T3 | V2 | `reader-ui-ux` | Add `/admin/recover` route consuming existing worker endpoints. |
| T4 | V3, V4 | `pwa-offline-sync` | Fix offline bookmark endpoint; add first-class queue types for bookmarks + insights with retry. |
| T5 | V6 | `reader-ui-ux` | Add Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs to `packages/ui` (Storybook + Vitest + axe per ADR-106). Dependency-free; unblocks V7/V11. |

### Phase 2 — P2 features & platform modernization (parallel swarm, after T5)

| Task | Closes | Skill |
|------|--------|-------|
| T6 | V7 | `cloudflare-worker-api` + `reader-ui-ux` — catalog pagination/search/filter (backend `PaginationDto` in `shared`, then CatalogPage UI). |
| T7 | V11 | `reader-ui-ux` — annotation import + locator-rich export (round-trip). |
| T8 | V8, V9 | `reader-ui-ux` — container queries for reader panels/admin tables; native `popover` for tooltips/menus/annotation toolbar (with `@supports` fallback). |
| T9 | V10 | `reader-ui-ux` — `useOptimistic` (annotate/bookmark/comment), `useFormStatus`/`useActionState` (login, grants). |
| T10 | V12 | `cloudflare-worker-api` — stream/multipart upload; Worker Cache API for read-mostly endpoints. |

### Phase 3 — P3 polish (parallel, low priority)

Pull the remaining P3 rows from plans 105 (B4/B5/B6/B7/B8, C4/C5, D2b–D5,
E3–E7, F1–F5, G1–G6, A9–A12), 105-ui (anchor positioning, scroll-snap,
per-element view-transition-name, logical properties sweep), and 107 (coverage
threshold raises, e2e expansion, DX tooling). Each ships independently.

## Quality gates

- Phase 1 gate: V1 covered by session-revocation-on-downgrade test; V5 by
  redaction unit tests; `./scripts/quality_gate.sh` green; Codacy PR check
  green; `security-code-auditor` re-run on touched worker files.
- Per PR: lint + typecheck + unit + coverage thresholds + build + e2e smoke.
- UI tasks: Storybook story + axe assertion + `prefers-reduced-motion` check.

## Synthesize — deliverables of THIS plan

- This consolidated, re-verified GOAP roadmap.
- Governance ADR (`plans/110-adr-completeness-and-ui-consolidation.md`).
- `plans/ADR-INDEX.md` row for ADR-110.
- Status correction: plan 105 A5 (insights UI) marked DONE here.
- No application code changed; remediation ships as the Phase 1–3 PRs.

## Compliance

- AGENTS.md TIER-2 rule 8 — issues documented as GOAP plan + ADR (no direct
  `KNOWN-ISSUES.md` edit).
- AGENTS.md TIER-1 "fix pre-existing issues" — V1 (TIER-1 session revocation)
  escalated to Phase 1 T1.
- ADR-083 numbering — `110` is the next free number after `109`.
