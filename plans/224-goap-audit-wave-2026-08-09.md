# GOAP 224: Audit Wave 2026-08-09 — Findings & Action Plan

**Date:** 2026-08-09
**Status:** IN PROGRESS
**Baseline commit:** `f1cd065` (main after PR #941 + #942)
**Method:** 6-dimension parallel swarm (security, correctness, performance, a11y, dead-code, test-coverage) with adversarial verification pass.
**Related:** Plans 212–223, ADR-212

---

## 1. Confirmed Findings

### P0 / P1 — Must fix (security or critical correctness)

| ID | Dim | Title | File | Line |
|----|-----|-------|------|------|
| A1 | security | `sanitizeSvg` uses FORBID_TAGS-only DOMPurify config — violates CLAUDE.md policy | `packages/reader-core/src/sanitizer.ts` | 264 |
| A2 | security | `foreignObject` in `EPUB_ALLOWED_TAGS` — can smuggle arbitrary HTML inside SVG context | `packages/reader-core/src/sanitizer.ts` | 137 |
| A3 | a11y | InfoPanel `role="dialog"` has no `useFocusTrap` — focus never enters or returns | `apps/web/src/features/reader/components/info/InfoPanel.tsx` | 74 |
| A4 | a11y | ReaderToolbar `aria-hidden` when scrolled, but buttons remain Tab-reachable (phantom focus zone) | `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx` | 419 |
| A5 | a11y | Dark-mode `accent-error` contrast 3.60:1 — fails WCAG AA 4.5:1 | `apps/web/src/styles/globals.css` | dark-mode block |
| A6 | perf | EPUB parser Worker never terminated on `destroy()` — globalPool persists broken state | `packages/reader-core/src/epub-loader.ts` | 339 |
| A7 | correctness | Race: `loadInner` writes state after `destroy()` — no `destroyed` guard after second await group | `packages/reader-core/src/epub-loader.ts` | 215 |
| A8 | correctness | `onerror` only rejects the first pending parse — all others hang 30s; crashed worker reused | `packages/reader-core/src/epub-parser-worker.ts` | 57 |
| A9 | correctness | `setError` called in `catch` without `active` guard — state update on unmounted component | `apps/web/src/features/reader/hooks/useReaderEpub.ts` | 363 |

### P2 — Should fix (high-value, clear fix)

| ID | Dim | Title | File |
|----|-----|-------|------|
| B1 | security | `GET /books/:bookId/comments` returns real `userEmail` of ALL commenters to any book reader | `apps/worker/src/routes/comments.ts:49` |
| B2 | security | `GET /admin/books/:id/grants` uses `SELECT *` — Argon2id hash fetched into Worker heap | `apps/worker/src/routes/admin/grants.ts:53` |
| B3 | security | `GET /admin/audit` offset has no `MAX_OFFSET` cap (unlike insights endpoint) | `apps/worker/src/routes/admin/audit.ts:12` |
| B4 | security | `POST /request` passes un-normalized `email` (not `emailKey`) to `createSession` | `apps/worker/src/routes/access.ts:225` |
| B5 | perf | LRU cache HIT re-parses full HTML with `DOMParser` — skips DOMPurify but still pays parse cost | `packages/reader-core/src/sanitizer.ts:447` |
| B6 | perf | No debounce on progress `PUT` — every page flip fires an immediate network request | `apps/web/src/features/reader/hooks/useEpubProgress.ts:52` |
| B7 | perf | Bundle delta violations omitted from PR comment — root cause invisible to reviewers | `scripts/check-bundle-budget.mjs:251` |
| B8 | a11y | `aria-haspopup="true"` on overflow trigger implies `role="menu"` but popup has none | `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx:264` |
| B9 | a11y | Color picker `aria-label` has hardcoded English `"colors"` suffix (untranslated) | `apps/web/src/features/reader/components/annotations/AnnotationToolbar.tsx:163` |
| B10 | a11y | Color picker `role="dialog"` has no focus trap | `apps/web/src/features/reader/components/annotations/AnnotationToolbar.tsx:158` |
| B11 | a11y | Badge counts on Comments/Bookmarks buttons not included in `aria-label` | `apps/web/src/features/reader/components/toolbar/ReaderToolbar.tsx:160` |
| B12 | dead | `LoadingFallback` in App.tsx is unreachable for all lazy routes; `useTranslation` import is dead | `apps/web/src/App.tsx:45` |
| B13 | dead | `PageLoadingFallback.tsx` has no production consumer after skeleton migration | `apps/web/src/components/PageLoadingFallback.tsx` |
| B14 | test | `useDocumentLocale` hook has zero test coverage | `apps/web/src/hooks/useDocumentLocale.ts` |
| B15 | test | `GET /admin/insights` NaN/non-numeric `limit`/`offset` fallback branch never exercised | `apps/worker/src/__tests__/routes.admin.test.ts` |
| B16 | test | `useKeyboardShortcut` `target` prop and lifecycle change untested | `apps/web/src/hooks/__tests__/useKeyboardShortcut.test.ts` |
| B17 | test | `skeletons.test.tsx` — `aria-hidden`/text-free checks only cover `LibrarySkeleton` | `apps/web/src/components/__tests__/skeletons.test.tsx` |
| B18 | test | Sanitizer LRU — `sanitizeDom` re-run on cache HIT not asserted in test | `packages/reader-core/src/__tests__/sanitizer.test.ts` |
| B19 | test | `insights` — non-numeric string param (`"abc"`) NaN fallback path untested | `apps/worker/src/__tests__/routes.admin.test.ts` |

### P3 — Backlog (low effort or low impact)

| ID | Dim | Title |
|----|-----|-------|
| C1 | a11y | `AccessibilitySection` key:value pairs use `div/span` instead of `dl/dt/dd` |
| C2 | a11y | 8/9 decorative SVGs in `OverflowMenu` lack `aria-hidden` |
| C3 | a11y | Mini progress bar in `ToolbarLeft` lacks `aria-hidden` (duplicate of `role="progressbar"`) |
| C4 | perf | `Array.from({ length: N })` in skeleton components not memoized |
| C14 | correctness | Cache HIT does not sync `<html>` element attributes (`lang`, `dir`) to live document |
| C5 | perf | Auth/admin pages (`LoginPage`, `AdminLoginPage`, etc.) eagerly imported into main bundle |
| C6 | security | LRU sanitizer cache misleading comment — `policyVersion` never passed at any call site |
| C7 | test | Sanitizer cache HIT test verifies no re-sanitization but not content correctness |
| C8 | test | Policy version invalidation only tests separate instances, not runtime bump |
| C9 | test | `ScrollProgressBar` has zero tests |
| C10 | dead | Plan 223 status is `IN REVIEW` — needs update to COMPLETED |
| C11 | dead | Plan 220 COMPLETED but not archived |
| C12 | dead | `AGENTS.md` worker coverage minimum stale (documents 55/50, enforces 65/60) |
| C13 | dead | LEARNINGS.md missing GOAP-223 plan summary section |

---

## 2. Wave Decomposition

### Wave 1 — Security (parallel, P0/P1 first)

| Task | Items | Key files |
|------|-------|-----------|
| W1.1 | A1: Fix `sanitizeSvg` to use `ALLOWED_TAGS` allowlist | `sanitizer.ts` |
| W1.2 | A2: Remove `foreignObject` from `EPUB_ALLOWED_TAGS` | `sanitizer.ts` |
| W1.3 | B1: Replace `userEmail` in shared comments response with display-safe identifier | `comments.ts` |
| W1.4 | B2+B3: Explicit column select in grants (exclude `password_hash`); add `MAX_OFFSET` cap to audit route | `grants.ts`, `audit.ts` |
| W1.5 | B4: Normalize `emailKey` before `createSession` | `access.ts` |

### Wave 2 — A11y (parallel with Wave 1, disjoint files)

| Task | Items | Key files |
|------|-------|-----------|
| W2.1 | A3: Add `useFocusTrap` to InfoPanel | `InfoPanel.tsx` |
| W2.2 | A4: Remove keyboard-reachable toolbar buttons when `aria-hidden` (use `tabIndex={-1}` or `inert`) | `ReaderToolbar.tsx` |
| W2.3 | A5: Darken dark-mode `--color-accent-error` to ≥ `oklch(63% 0.2 25)` | `globals.css` |
| W2.4 | B8+B9+B10+B11: Fix overflow menu `aria-haspopup`, translate color picker label, add focus trap, add counts to aria-labels | `ReaderToolbar.tsx`, `AnnotationToolbar.tsx` |

### Wave 3 — Perf + correctness (after Wave 1)

| Task | Items | Key files |
|------|-------|-----------|
| W3.1 | A6+A7+A8+A9: Fix epub-parser-worker `onerror` to reject all pending + restart pool; add `destroyed` guards after all `await`s in `loadInner`; add `if (active)` guard in `catch`; call `terminateParserWorker()` in `destroy()` | `epub-loader.ts`, `epub-parser-worker.ts`, `useReaderEpub.ts` |
| W3.2 | B5: Store sanitized DOM nodes directly (not serialized HTML) to avoid re-parse on cache HIT, or remove the cache if the overhead exceeds benefit | `sanitizer.ts` |
| W3.3 | B6: Add `debounce` (500ms) to progress `PUT` handler | `useEpubProgress.ts` |
| W3.4 | B7: Append baseline delta table to `summary` in `check-bundle-budget.mjs` | `scripts/check-bundle-budget.mjs` |

### Wave 4 — Dead code + docs + tests (housekeeping)

| Task | Items | Key files |
|------|-------|-----------|
| W4.1 | B12+B13: Remove `LoadingFallback` and `useTranslation` from App.tsx; delete or re-purpose `PageLoadingFallback.tsx` | `App.tsx`, `PageLoadingFallback.tsx` |
| W4.2 | B14+B15+B16: Add tests for `useDocumentLocale`, insights NaN inputs, and `useKeyboardShortcut` target lifecycle | test files |
| W4.3 | C1–C3: `dl/dt/dd` in AccessibilitySection; `aria-hidden` on decorative SVGs and mini progress bar | `InfoPanel.tsx`, `ReaderToolbar.tsx` |
| W4.4 | C10–C13: Archive plan 220/223, update plan status, fix AGENTS.md coverage docs, add LEARNINGS.md GOAP-223 section | `plans/`, `AGENTS.md`, `agents-docs/LEARNINGS.md` |

---

## 3. Execution Strategy

One PR per wave. Each passes `./scripts/quality_gate.sh`. Wave 1 (security) is highest priority — P1 security findings block all other waves from review perspective.

Wave 1 and Wave 2 are disjoint file sets → can be developed in parallel branches.

---

## 4. Acceptance Criteria

- [ ] W1.1: `sanitizeSvg` uses `ALLOWED_TAGS` only; no `FORBID_TAGS`-only path in reader-core
- [ ] W1.2: `foreignObject` removed from `EPUB_ALLOWED_TAGS`; EPUB sanitizer tests updated
- [ ] W1.3: `/comments` endpoint omits `userEmail` for shared comments; uses anonymized display name or truncated identifier
- [ ] W1.4: grants SELECT excludes `password_hash`; audit offset capped at `MAX_OFFSET`
- [ ] W1.5: `createSession` called with `emailKey` in access.ts
- [ ] W2.1: InfoPanel passes `useFocusTrap(isOpen, panelRef)` — focus enters on open, returns on close
- [ ] W2.2: Toolbar buttons not reachable by Tab when `aria-hidden`
- [ ] W2.3: Dark-mode `text-accent-error` on `bg-accent-error/10` ≥ 4.5:1
- [ ] W2.4: Overflow menu popup has correct ARIA role; color picker label translated; focus trap on picker; counts in button aria-labels
- [ ] W3.1: `epub-loader.ts` destroy() calls `terminateParserWorker()`
- [ ] W3.2: LRU cache HIT does not invoke `DOMParser.parseFromString`
- [ ] W3.3: Rapid page-flip generates at most 1 PUT per 500ms
- [ ] W3.4: PR comments show baseline delta table when budget fails
- [ ] W4.1: `LoadingFallback` and dead import removed from App.tsx; `PageLoadingFallback` deleted or repurposed
- [ ] W4.2: `useDocumentLocale`, insights NaN, and `useKeyboardShortcut` target lifecycle covered by tests
- [ ] W4.3: `AccessibilitySection` uses `dl/dt/dd`; SVGs and mini bar aria-hidden
- [ ] W4.4: Plans archived/updated; AGENTS.md and LEARNINGS.md current
- [ ] All waves: `./scripts/quality_gate.sh` passes; CI green
