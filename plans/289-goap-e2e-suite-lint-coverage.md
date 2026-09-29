# GOAP-289: Put the Playwright suite inside the lint gate

**Status:** DONE (2026-09-29) — `apps/tests` is now a workspace package with a `lint`
task, so the Playwright suite is inside the gate that was previously skipping it. Writing
the GOAP-284 browser spec surfaced `CREATOR_EMAIL`, a constant assigned and never used,
which survived because nothing linted the file that held it.

**Date:** 2026-09-29
**Strategy:** Measure the debt, classify it honestly, then decide per rule rather than blanket-allow.

## Problem

`pnpm-workspace.yaml` declares `apps/*`, and `apps/tests` matches that glob — but the
directory has no `package.json`, so pnpm never makes it a workspace package and
`turbo run lint` has no task to run there. Every real package lints `src`:

```json
"lint": "eslint src --ext .ts,.tsx --max-warnings 0"
```

`apps/tests` is not anyone's `src`. The Playwright suite is therefore unlinted, despite
`eslint.config.js` already carrying a rules override for `**/tests/**` — an override that
applies to nothing, because the files never reach ESLint.

Codacy has the same hole: `.codacy.yml` excludes `**/tests/**` from both `eslint-8` and
`opengrep` (ADR-215 Decision 2). So the 308-line spec added in PR #1256 had **no static
analysis at all**, and a dead constant reached the merge gate.

## Measured debt

`pnpm exec eslint apps/tests --no-ignore` — 66 errors across 25 files:

| Count | Rule                                               | Assessment                                |
| ----- | -------------------------------------------------- | ----------------------------------------- |
| 58    | `@typescript-eslint/no-non-null-assertion`         | Canonical Playwright narrowing idiom      |
| 2     | `@typescript-eslint/require-await`                 | `async` on a callback that need not await |
| 2     | `@typescript-eslint/prefer-promise-reject-errors`  | **Real**: can reject with `null`          |
| 1     | `no-empty`                                         | Swallowed `catch {}` in a fetch probe     |
| 1     | `unicorn/prefer-optional-catch-binding`            | Unused catch binding                      |
| 1     | `@typescript-eslint/no-unused-vars`                | **Real**: an unused parameter             |
| 1     | `@typescript-eslint/no-unnecessary-type-assertion` | Redundant `as`                            |

Concentrated in `login-responsive-controls.spec.ts` (27) and `viewport-regression.spec.ts`
(20), both of which use `await expect(box).not.toBeNull()` followed by `box!.x`.

## Decision

Make `apps/tests` a workspace package with a `lint` task, so the existing `apps/*` glob
picks it up with no `pnpm-workspace.yaml` change and no gate change. Then resolve the
debt per rule:

- **`no-non-null-assertion` (58)** — do not rewrite 58 sites and do not blanket-disable.
  The assertions are the documented Playwright narrowing pattern. Turn the rule **off for
  `**/tests/**` only**, where `no-floating-promises` and `no-misused-promises` are already
  relaxed for the same reason: an `await expect(...)` assertion is not a type guard to
  TypeScript, so the non-null assertion is the honest spelling, not a shortcut.
- **The 8 remaining errors** — fix them. They are small, and three of them are real:
  a `reject(req.error)` that can reject with `null`, a swallowed `catch {}`, and an
  unused parameter.

This keeps the gate honest: the suite is linted, the zero-warning policy applies, and the
one rule that genuinely cannot be enforced here is relaxed with a reason rather than
silently ignored.

## Acceptance criteria

- [x] `apps/tests` has a `package.json` with a `lint` script, and `turbo run lint` runs it.
      The existing `apps/*` workspace glob already matched the directory, so no
      `pnpm-workspace.yaml` change was needed.
- [x] `pnpm exec eslint apps/tests` passes with no error, without `--no-ignore`.
- [x] The 8 non-assertion errors are fixed at source, not suppressed. Three were real:
      a `reject(req.error)` that could settle with `null`, a swallowed `catch {}`, and two
      `async` hooks that awaited nothing. The rest were an unused catch binding, a
      redundant `as`, and an unused export (`E2ELocale`, caught by knip).
- [x] `no-non-null-assertion` is disabled for the Playwright suite only, with the reason
      recorded. **Scoped to `apps/tests/**` after the first attempt failed**: widening it to
      the shared `**/tests/**` override stranded five now-redundant
      `eslint-disable-next-line` directives in `reader-core`, which `--max-warnings 0`
      treats as a failure. Unit tests and `src` keep the rule.
- [x] `apps/tests` does not acquire a duplicate `test:unit` task, so the existing suite
      count is unchanged — web is still 138 files / 1410 tests.
- [x] `SKIP_DESIGN=1 ./scripts/quality_gate.sh` still passes, and a deliberately broken
      spec fails the gate: a `CANARY_UNUSED` constant appended to a spec produced
      `@typescript-eslint/no-unused-vars` and exit 1, which is the same class as the
      `CREATOR_EMAIL` that started this.
- [x] Codacy's exclusion of `**/tests/**` is reconciled. It is left as-is under ADR-215
      Decision 2, which already designates the repo's type-aware lint pipeline as the
      authoritative gate for that source. GOAP-289 is what makes that statement true:
      before this, `apps/tests` was excluded from Codacy **and** unlinted locally, so it
      had no static analysis at all.

## Risks and mitigations

| Risk                                          | Mitigation                                                                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| New lint task breaks turbo's dependency graph | Package has no `build`; lint depends on nothing, so it cannot deadlock                                                      |
| Relaxing a rule hides a real class            | Scoped to `**/tests/**` only; `src` keeps the rule. The narrowing idiom is the alternative spelling, not a suppressed error |
| Playwright devDeps resolved twice             | Reuse the root's `@playwright/test`; no new dependency                                                                      |
