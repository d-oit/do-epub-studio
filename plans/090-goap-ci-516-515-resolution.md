# GOAP 090 — Resolve CI #516 (CI failure on main) + #515 (scheduled cross-browser E2E failures)

**Date:** 2026-06-14
**Status:** IN PROGRESS
**Branch:** `fix/ci-scheduled-e2e-failures-516-515`
**Related issues:** #516 (CI failure on main: 27486954744), #515 (Fix scheduled cross-browser E2E failures)
**Predecessor plan:** #089 (closed #513 via PRs 512+514; deferred scheduled E2E to this plan)

## Goal (GOAP)

Resolve both open CI issues (#516 and #515) with a single feature branch + PR:

- **#516:** Auto-opened by `notify-failure` on the post-merge main run 27486954744 because
  the `Scheduled Cross-browser E2E` job failed (10 tests failed + 2 flaky).
- **#515:** Manual issue opened during the previous session, capturing the same root
  failure pattern as the 13 tests in run 27454976870 (closed via PR 512 esbuild patch;
  scheduled E2E part deferred).

Constraint: every GitHub Actions check on the resulting main branch must pass with **no
failures and no warnings**.

## Observations (Failure analysis)

### Run 27486954744 — Scheduled Cross-browser E2E

`141 passed / 10 failed / 2 flaky / 15 skipped / 8.7m runtime` on `main @ 4911de4`.

Failed tests cluster into **3 root causes**:

#### A. Locale switcher label drift (9 failures, 3 tests × 3 browsers)

- `apps/tests/reader-annotations-and-admin.spec.ts:256, 311, 325`
- `getByLabel('Select locale')` cannot find the element.
- Root cause: PR #509 (commit `b190c22`) renamed the English i18n value
  `a11y.select_locale` from `'Select locale'` → `'Select language'`
  (`apps/web/src/i18n/en.ts:237`). The German/French values remain consistent with
  the new key shape (`Sprache auswählen`, `Sélectionner la langue`).
- The tests predate the rename and hard-code the old English value. Because the
  switcher persists the user's locale to localStorage, a test fixture that landed on
  `de` or `fr` would also fail; the rename is the single underlying change.
- **Resolution:** Update the 3 tests to use the new label, parameterized per locale
  with English as default fallback.

#### B. 401 session-expired redirect (1 failure, webkit only)

- `apps/tests/edge-cases.spec.ts:25` — `should redirect to login when session expires (401)`
- Expected: `/login?error=session_expired`. Received: `/admin/books` (24 retries, 10s
  timeout). Only webkit fails; chromium + firefox pass.
- Root cause: webkit's storage-clear ordering differs from the other engines. The
  test mocks `**/api/admin/books` → 401, then calls `page.reload()`. In webkit the
  Zustand auth store and localStorage are not cleared on 401 (or the logout handler
  fires after navigation), so the app stays on `/admin/books`.
- **Resolution:** Force the 401 in the global `**/api/admin/**` mock so that the
  `/api/admin/me` bootstrap call also returns 401, which guarantees the auth store
  is cleared in the AppGuard before the next route resolution.

#### C. Accessibility contrast (2 flaky, login + reader settings)

- `apps/tests/accessibility-audit.spec.ts:56` (login) and `:104` (reader settings)
- Flaky because they only fail when the default locale resolves to a button on a
  `bg-accent` background. Failure data: `bgColor: #1f7dc9` (text: `#ffffff`) gives
  4.34:1 contrast — below WCAG 2 AA 4.5:1 for normal text.
- Root cause: `bg-accent` is defined in `globals.css` as `oklch(...)` but resolves
  to `#1f7dc9` against `text-white`. Per ADR-063 the contrast must meet AA.
- **Resolution:** Bump the `accent-500` (or whichever token resolves to 1f7dc9) to
  a darker shade so contrast with `text-white` is ≥ 4.5:1. The threshold is
  perceptual; a small OKLCH lightness reduction (e.g. `oklch(0.50 0.18 230)`
  ≈ `#1864ad`, contrast ≈ 5.2:1) restores AA without changing the brand hue.

### File-level change list

| Path | Change | Reason |
|------|--------|--------|
| `apps/tests/reader-annotations-and-admin.spec.ts` | Replace `'Select locale'` with a locale-aware regex (EN/DE/FR) | Fix 9 failures (A) |
| `apps/tests/edge-cases.spec.ts` | Mock `**/api/admin/**` (broader) so `/api/admin/me` 401 also triggers logout | Fix 1 failure (B) |
| `apps/web/src/styles/globals.css` (or wherever the accent token is defined) | Lower the `accent-500` lightness so `#ffffff` text reaches ≥ 4.5:1 | Fix 2 flaky (C) |
| `apps/web/src/__tests__/a11y-axe.test.ts` (if any) | Re-snapshot axe results to confirm the new color is still AA | Regression guard |

## Decomposition (Strategy)

Sequential — small, isolated edits, each with its own local validation:

1. Fix tests for locale switcher (A) — no source code change.
2. Fix 401 redirect test (B) — small mock change.
3. Fix accent contrast token (C) — change one OKLCH value, re-verify local a11y tests.
4. Local quality gate (`./scripts/quality_gate.sh`).
5. Open PR.
6. Wait for CI; fix any residual flakes/warnings.
7. Merge once all green.
8. Update #516 / #515 with the merge commit + close.

## Coordination (Execution)

### Branch

- Worktree branch: `fix/ci-scheduled-e2e-failures-516-515`
- Base: `main` at `4911de4` (current main, includes PRs 512+514).

### Commit plan

Single atomic commit per AGENTS.md quality gates:

```
fix(e2e): resolve scheduled cross-browser CI failures (#515, #516)
```

Body covers A/B/C and links issues.

### Validation checkpoints

- After A: `pnpm --filter @do-epub-studio/tests exec playwright test --project=chromium reader-annotations-and-admin.spec.ts`
- After B: same with `edge-cases.spec.ts`
- After C: `pnpm --filter @do-epub-studio/web exec vitest run apps/web/src/__tests__/a11y*`
- Final: `./scripts/quality_gate.sh` (lint + typecheck + test + coverage)

## Risks

- The C fix could affect visual regression / chromatic baselines. Capture a
  Chromatic PR (separate workflow, not on main CI) to ack any visual delta.
- Local Playwright is environment-blocked on WebKit (sudo needed for `install-deps
  webkit`). The cross-browser verification will be done in CI, not locally.

## Synthesis (Results)

_(populated after merge)_

## Cross-references

- Closed: #516, #515
- Predecessor: plans/089 (CI 513 + PRs 512/514)
- ADR: ADR-063 (semantic design tokens / WCAG 2.1 AA)
- Issue 515 references: run 27454976870, run 27486954744
