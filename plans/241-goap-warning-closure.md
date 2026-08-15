# GOAP-241: Remaining Pre-Existing Build Warnings + Baseline Closure

**Date:** 2026-08-14
**Status:** Submitted (PR #984, branch `feat/goap-241-warning-closure`) — all executing CI checks green; Chromatic "UI Tests" baseline-acceptance gate pending org access (per LEARNINGS); no actionable review comments (repowise health gate passed).
**Baseline:** `main` @ `338e024` (post GOAP-240, PR #982/#983)
**Related:** Plans 238, 240; ADR-024 (warning management); ADR-216 (Vitest pool);
`agents-docs/LEARNINGS.md`

## Goal

Clear or explicitly close the last remaining pre-existing build warnings a
developer sees on every `pnpm build`, and validate that the outstanding
deferred items remain correctly gated (not implementable in an open PR).

## Analysis (verify-driven against `main`)

A full local gate run on `main` (`pnpm lint`, `pnpm typecheck`, `pnpm knip`,
`pnpm test:unit` for all 7 packages, `scripts/dead-code-check.sh`,
`node scripts/check-adr-index.mjs`, `node scripts/check-agent-sync.mjs`) is
**green**. No open GitHub issues and no open PRs exist on the repo. All live
`plans/` GOAP records (237–240) and the ADR-INDEX are closed/updated.

The only remaining warnings surface during `pnpm build`:

| Warning | Source | Verdict |
| --- | --- | --- |
| worker: `node:async_hooks` "isn't found on the file system but is built into node… enable nodejs_compat" | `@sentry/cloudflare` (`build/esm/async.js`) | **Fixable** — worker `apps/worker/wrangler.jsonc` lacked `compatibility_flags: ["nodejs_compat"]`. Added in this PR. |
| web: `inlineDynamicImports` option is deprecated → `codeSplitting: false` | vite-plugin-pwa `injectManifest` service-worker bundling (single-file SW forces `inlineDynamicImports`) | **Not ours** — plugin-internal default, no tracked config source (confirmed GOAP-240). Do not chase; app needs code-splitting for the main client build. |
| web: `Module "node:crypto" has been externalized for browser compatibility` | `apps/web/src/lib/offline/crypto.ts` guarded `await import('node:crypto')` | **Benign/intended** — dynamic import deliberately falls back to the browser `crypto` global outside Node runtimes (vitest/SSR); warning is informational, not a deprecation. |

## Implementation (scout-verified)

A 3-agent scout swarm (warnings, non-null assertions/unsafe casts, TODO/dead-code)
audited the monorepo; fixes below are the verified, low-risk subset.

| Slice | Change | Files |
| --- | --- | --- |
| Worker flag | Add `compatibility_flags: ["nodejs_compat"]` so the Sentry SDK's `node:async_hooks` import stops warning and works at runtime; document the requirement | `apps/worker/wrangler.jsonc` |
| Turbo cache | Track `wrangler*.{jsonc,json,toml}` as a `build` task input so `pnpm build` invalidates the worker-build cache when wrangler config changes (otherwise `pnpm build` kept replaying a stale cached `async_hooks` warning) | `turbo.json` |
| Stale eslint disables | 15 factually-wrong `eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void` comments (react-router v7 `NavigateFunction` is `void \| Promise<void>`, so the rule correctly fires). Fix: `void navigate(...)` + delete the `no-floating-promises` suppression; LoginPage keeps its legitimate `i18next/no-literal-string` suppression | `AppShell.tsx` ×4, `AccountSettingsPage.tsx` ×1, `AdminDashboardPage.tsx` ×4, `AdminRecoverPage.tsx` ×1, `BooksPage.tsx` ×3, `LoginPage.tsx` ×1 |
| activeElement narrowing | Replace unsafe `document.activeElement as HTMLElement` casts with `instanceof HTMLElement` guarded locals (Element → HTMLElement narrowing is unsound; SVGElement etc. are not HTMLElement) | `packages/ui/src/useFocusTrap.ts`, `packages/ui/src/modal.tsx` |
| Double cast | Replace `m as unknown as Record<string, unknown>` with an explicit `{ p50, p95, p99, count }` literal (avoid `as unknown as` escaping the type system) | `apps/web/src/features/reader/hooks/useReaderEpub.ts` |

Scout-verified non-issues (intentionally unchanged, documented): `useFocusTrap.ts` `focusable[0]` casts are NOT redundant (`noUncheckedIndexedAccess` is on; the `length === 0` guard makes them safe) — restored after a first-pass removal broke typecheck; `deps/navigation/shared.tsx` `DEFAULT_PATH` non-null assertion is correct; dead code is clean post GOAP-237/238/239/240 — no TODO/FIXME/stubs remain; `useImportNotes.ts` is a deferred feature (implemented + tested, no UI wiring yet), not dead code.

## Acceptance Criteria

- [x] `pnpm --filter @do-epub-studio/worker build` emits NO `node:async_hooks` warning; `pnpm build` (turbo) also clean after adding wrangler config to build inputs; worker deploy dry-run + 419 worker tests green.
- [x] 15 stale/factually-wrong `no-floating-promises` eslint disables removed; web lint + typecheck clean; all affected page/hook tests green (web 1279, ui 141).
- [x] `document.activeElement as HTMLElement` unsafe narrowing replaced with `instanceof` guards (ui typecheck + focus-trap/Modal tests green).
- [x] `as unknown as` double cast in reader perf telemetry replaced with explicit literal (web typecheck + reader tests green).
- [x] Web build warnings (`inlineDynamicImports` plugin-internal, `node:crypto` guarded import) verified benign, documented in plan, not regressed.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `scripts/dead-code-check.sh`, `scripts/check-adr-index.mjs`, agent-sync all green; full CI green on the PR.
- [x] Plans/ADR-INDEX updated; LEARNINGS entry added; PR review comments addressed.

## Out of Scope (verified, still deferred)

- R1/R12/N3 email gate, S1–S9, O2, P5/P7 — private security triage (ADR-212/214), not implementable in an open PR.
- ADR-217 OTel decision — accepted deferral.
- `inlineDynamicImports` warning — vite-plugin-pwa/rolldown internal (GOAP-240), no repo config source.
