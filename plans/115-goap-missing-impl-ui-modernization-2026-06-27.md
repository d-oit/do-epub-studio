# GOAP 115 — Missing-Implementation & UI-Modernization Audit (2026-06-27)

**Date:** 2026-06-27
**Status:** 📋 PROPOSED — recommendations only; **no source code changed by this plan**
**Author:** Amp analysis session (verified against working tree, not carried forward)
**Methodology:** GOAP (analyze → decompose → strategize → coordinate → execute → synthesize)
**UI tooling:** `impeccable` skill (`audit`) + bundled anti-pattern detector
**Extends / corrects:** Plan 114 (comprehensive audit, same day) — several "OPEN" items re-verified as **already implemented**
**Related ADR:** `plans/115-adr-verified-audit-remediation-policy.md`

---

## Goal

Produce an **evidence-verified** backlog of (a) genuinely missing/incomplete
implementation and (b) UI-modernization recommendations from the `impeccable`
detector. Every finding below was checked against the current working tree;
stale findings from prior plans are explicitly corrected so the team does not
re-open already-closed work.

---

## Analyze — Baseline

| Signal | Result |
|--------|--------|
| Stack | React 19 / Vite 8 / Tailwind 4 / Hono Workers / Turso / R2 / Durable Objects |
| `packages/ui` primitives | Button, Card, Input, Modal, Toast, Tooltip, Badge, Skeleton, Spinner, **Pagination, ConfirmDialog, SearchInput, ProgressBar, Tabs** — all present |
| TODO/FIXME in prod source | 0 (only `VirtualList.tsx` documents a deliberate non-goal) |
| Impeccable detector hits | 10 total (`apps/web/src` + `packages/ui/src`) |

### ⚠️ Corrections to Plan 114 (verified false-OPEN)

Plan 114 lists these as OPEN; the working tree shows them **DONE**. Do **not** schedule them.

| Plan-114 ID | Claim | Verified reality |
|-------------|-------|------------------|
| **B1** | Grant PATCH doesn't revoke sessions (TIER-1) | **DONE** — [grants.ts](file:///home/doit/do-epub-studio/apps/worker/src/routes/admin/grants.ts) PATCH revokes `reader_sessions` atomically (lines 99–122) + audit `sessionsRevoked: true` |
| **A2/A3/A4** | No first-class bookmark/insight sync-queue type | **DONE** — [offline/sync.ts](file:///home/doit/do-epub-studio/apps/web/src/lib/offline/sync.ts) has `bookmark` + `reading-insight` queue types with dedicated endpoints |
| **A8** | Annotation import missing; export omits CFI | **DONE** — [useImportNotes.ts](file:///home/doit/do-epub-studio/apps/web/src/features/reader/hooks/useImportNotes.ts) merges by id; [useExportNotes.ts](file:///home/doit/do-epub-studio/apps/web/src/features/reader/hooks/useExportNotes.ts) emits `[cfi]` |
| **D1/D2** | AuditLogPage `overflow-hidden` / fixed `p-8` | **DONE** — `overflow-x-auto` + `p-4 sm:p-6 lg:p-8` present |
| **D3/D4** | BooksPage header overflow / fixed `p-8` | **DONE** — `flex justify-between flex-wrap` + responsive padding present |
| **D5** | Duplicate nested `role="progressbar"` | **NOT REPRODUCED** — single progressbar in [ReaderToolbar.tsx:478](file:///home/doit/do-epub-studio/apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx#L478); the test's `getAllByRole` matches one node |

---

## Findings — Verified & Current

### A. Missing / Incomplete Implementation

| ID | Sev | File | Finding | Evidence |
|----|-----|------|---------|----------|
| M1 | P2 | [useReaderSearch.ts:96](file:///home/doit/do-epub-studio/apps/web/src/features/reader/hooks/useReaderSearch.ts#L96) | `spine.get(result.cfi)` passes a **CFI** to a method that expects an href/idref/index → chapter-title lookup silently returns `undefined` for search hits | epub.js `spine.get` does not resolve CFIs; derive the section href from the CFI base path instead |
| M2 | P2 | [email-transport.ts:49](file:///home/doit/do-epub-studio/apps/worker/src/lib/email-transport.ts#L49) | When `SEND_EMAIL` binding is absent, `createEmailTransport` silently returns `LoggingEmailTransport` — magic-link/recovery mail is dropped with no operator-visible warning in prod | Add a startup/`env`-guard warning (or hard-fail in `production`) so a misconfigured deploy is detectable |
| M3 | P3 | [offline/sync.ts](file:///home/doit/do-epub-studio/apps/web/src/lib/offline/sync.ts) | **Redundant queue paths**: a `bookmark` reaches the server both via legacy `annotation` (`payload.annotation.type==='bookmark'` → `/bookmarks`) and via first-class `bookmark` type → same endpoint. Likewise `insight` vs `reading-insight` both POST `/insights/sync` | Consolidate to the first-class types; deprecate the legacy `annotation`-routed bookmark/insight branches to remove dead/ambiguous paths |
| M4 | P3 | [useReaderEpub.ts](file:///home/doit/do-epub-studio/apps/web/src/features/reader/hooks/useReaderEpub.ts) | Offline reader fallback re-displays `progressCfi` and re-renders highlights, but cached **comments/bookmarks** restoration on the offline path is not asserted by any test | Add an offline-restore test that seeds IndexedDB highlights + comments + bookmarks and verifies all three render |
| M5 | P3 | [audit.ts:72](file:///home/doit/do-epub-studio/apps/worker/src/routes/admin/audit.ts#L72) | `/api/admin/audit-logs` is a **301 → /audit** alias only. Intentional back-compat, but undocumented | Document as an intentional alias (or drop if no client uses it); no functional gap |
| M6 | P3 | [VirtualList.tsx:13](file:///home/doit/do-epub-studio/apps/web/src/components/VirtualList.tsx#L13) | Variable-row-height virtualization is a **documented non-goal** | Leave as-is unless a long-list view needs variable heights; track only |

### B. UI Modernization — `impeccable` detector

**Real anti-patterns (action recommended):**

| ID | Sev | File | Pattern | Recommendation |
|----|-----|------|---------|----------------|
| U1 | **P2** | [LoginPage.tsx:230](file:///home/doit/do-epub-studio/apps/web/src/features/auth/LoginPage.tsx#L230) | **side-stripe border** (`border-l-3 border-accent-error rounded-r`) — impeccable **absolute ban** ("most recognizable AI tell") | Replace with full `border border-accent-error/30` + `bg-accent-error/10` tint, or a leading inline error icon. Drop `rounded-r` |
| U2 | P3 | [App.tsx:64](file:///home/doit/do-epub-studio/apps/web/src/App.tsx#L64), [PageLoadingFallback.tsx:25](file:///home/doit/do-epub-studio/apps/web/src/components/PageLoadingFallback.tsx#L25) | **bounce-easing** (`animate-bounce` loading dots) — violates DESIGN.md "no bounce/elastic" | Swap the three-dot `animate-bounce` for a staggered opacity/translate pulse on an `ease-out` curve (respect `prefers-reduced-motion`) |
| U3 | P3 | [globals.css:69](file:///home/doit/do-epub-studio/apps/web/src/styles/globals.css#L69) | `--ease-out-back: cubic-bezier(0.34,1.56,0.64,1)` is an overshoot/back token (flagged as bounce) | Audit usages; if used, retarget to `--ease-out-expo`; if unused, remove the token to keep the motion system on-brand |
| U4 | P3 | [globals.css:77](file:///home/doit/do-epub-studio/apps/web/src/styles/globals.css#L77) | **overused-font** `Geist` — PRODUCT.md/DESIGN.md call for an *editorial* serif/sans pairing, not a generic AI-default sans | Decide deliberately: either commit to a serif display + humanist body pairing (matches "book app, not SaaS" brand), or document Geist as an intentional choice to silence the rule |

**False positives (no action / consistency win only):**

| ID | File(s) | Pattern | Why it's a false positive |
|----|---------|---------|---------------------------|
| U5 | AuditLogPage:151, BooksPage:304, GrantsPage:242, GrantList:77, ReaderViewer:29 | `border-accent-on-rounded` (`border-b-2`) | These are the **CSS spinner technique** (`animate-spin rounded-full h-8 w-8 border-b-2 border-accent`), not accent borders on cards. **Recommendation:** replace the five hand-rolled spinner `<div>`s with the existing [`<Spinner>`](file:///home/doit/do-epub-studio/packages/ui/src/spinner.tsx) primitive — removes duplication and silences the rule |

### C. Minor responsive / a11y polish (verified still-present)

| ID | Sev | File | Finding |
|----|-----|------|---------|
| C1 | P3 | [ReaderViewer.tsx:35](file:///home/doit/do-epub-studio/apps/web/src/features/reader/components/viewer/ReaderViewer.tsx#L35) | `h-[calc(100vh-8rem)]` uses `100vh`; on mobile the URL bar steals height → use `100dvh` |

### D. Performance

| ID | Sev | Finding |
|----|-----|---------|
| P1 | P3 | `framer-motion@^12` is a dependency of **both** `apps/web` and `packages/ui` (~30 KB gzip). Current usage is subtle enter/exit + `AnimatePresence`. Evaluate the lighter `motion` package (same API, smaller core) or CSS-only transitions for the simplest cases. Measure with the existing performance budgets before committing |

---

## Decompose — Task Clusters (recommendations only)

| Cluster | Items | Ships as |
|---------|-------|----------|
| **1 — UI ban fix** (highest signal) | U1 | `fix/login-error-alert-no-side-stripe` |
| **2 — Motion on-brand** | U2, U3 | `fix/replace-bounce-loading-motion` |
| **3 — Spinner consolidation** | U5 (+ silences 5 detector hits) | `refactor/use-shared-spinner` |
| **4 — Search chapter lookup** | M1 | `fix/search-chapter-title-cfi` |
| **5 — Email transport guard** | M2 | `fix/email-transport-missing-binding-warning` |
| **6 — Sync queue de-dup** | M3 | `refactor/offline-sync-queue-consolidation` |
| **7 — Offline restore test** | M4 | `test/offline-restore-annotations` |
| **8 — Mobile viewport unit** | C1 | folds into Cluster 1 or 3 |
| **9 — Typography decision** | U4 | needs design decision before code |
| **10 — Perf eval (spike)** | P1 | investigation, not a guaranteed change |

---

## Strategize — Priority Order

1. **Cluster 1** (U1) — impeccable absolute ban, one-file fix, visible
2. **Cluster 3** (U5) — removes duplication, clears 5 detector hits at once
3. **Cluster 4** (M1) — real functional bug (search chapter titles)
4. **Cluster 5** (M2) — operability/observability of mail delivery
5. **Cluster 2** (U2/U3) — motion polish
6. **Cluster 6** (M3) + **Cluster 7** (M4) — offline correctness/clarity
7. **Cluster 9** (U4) — design decision, then act
8. **Cluster 10** (P1) — measure first

No item is TIER-1: the prior TIER-1 concern (B1) is already shipped.

---

## Coordinate — Ship Strategy

Each cluster is independently shippable on its own feature branch per AGENTS.md
(no `main` commits). Quality gate + Codacy required before each merge. Clusters
1–3 are zero-risk visual/structural; Clusters 4–7 require a unit test added with
the fix.

---

## Acceptance Criteria (when executed in follow-up plans)

- [x] Login error alert uses a full border + tint (no `border-l-*` stripe); detector `side-tab` = 0 — **PR #675**
- [x] Loading indicators use `ease-out` motion; detector `bounce-easing` = 0; `prefers-reduced-motion` honored — **PR #675**
- [x] All five spinner sites use `<Spinner>`; detector `border-accent-on-rounded` = 0 — **PR #676**
- [x] Search results show correct chapter titles (M1 test added) — **PR #675**
- [x] Missing email binding surfaces an operator-visible warning (M2 test added) — **PR #675**
- [x] Offline restore renders highlights + comments + bookmarks (M4 test added) — **PR #680, expanded #738**
- [ ] Typography decision recorded (U4) — either re-pair or document Geist — **P3, still open**
- [x] No new Codacy issues; coverage thresholds held — **PR #738 all green**

---

## Monitor

- Re-run `node .claude/skills/impeccable/scripts/detect.mjs --json apps/web/src packages/ui/src` after each UI cluster; target total hits → 0 (or documented suppressions).
- Lighthouse mobile budgets stable after motion/perf changes.
- `pnpm test` + `pnpm test:e2e` green.

---

## Synthesize — Headline

The platform is **far more complete than Plan 114 implies**: the lone TIER-1
item (grant session revocation) and the previously-flagged P1 offline/import
gaps are already shipped. What genuinely remains is **one UI absolute-ban
(U1)**, **motion/spinner polish (U2/U3/U5)**, **one real search bug (M1)**, and
a handful of P3 hardening/clarity items. None block release; all are small,
independent, and individually verifiable.
