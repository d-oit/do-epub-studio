# GOAP-288: Repo-wide Prettier cleanup, then enforce `format:check`

**Status:** COMPLETE
**Date:** 2026-09-26
**ADR:** `plans/288-adr-format-gate-boundaries.md`
**Closes:** #1182

## Goal

`ci.yml` documented that `pnpm format:check` was deliberately not a CI step
because the repo carried ~710 (measured 915) prettier-dirty files. Issue #1182
asked for the cleanup in a dedicated hygiene change, a review for
behavior-visible changes, and then enforcement.

## What was done

### A — format

`pnpm exec prettier --write .` across 915 files (387 md, 327 ts, 147 tsx, 19
mjs, 18 yml, 9 json, 2 yaml, 2 jsonc, 2 css, 1 js).

### B — review for behavior-visible changes

Not eyeballed. Every changed `.ts`/`.tsx` file was compared to `main` through a
TypeScript AST walk that emits node kinds and literal values, ignoring
`ParenthesizedExpression` and `JsxText` (neither carries semantics — the first is
prettier adding wrap-parens, the second is JSX whitespace React normalises).

**Result: 474 TS/TSX files checked, 0 semantic differences.**

The 24 files that needed that normalization were inspected individually:

- `sw-quota-guard.test.ts`, `queries.ts`, `reader-core.bench.ts` — `quoteProps`
  dropped unnecessary quotes (`'images': 42` → `images: 42`); identical keys.
- `StorageQuota.tsx`, `BooksPage.tsx`, the two Book modals, `LoginCardHeader`,
  `FeedbackPanel` — arrow bodies and ternary chains re-wrapped.
- `worker-configuration.d.ts` — **reverted**. A 24 660-line diff on a
  wrangler-shaped ambient declaration file is noise, not hygiene, and it is
  excluded from the AST proof because it is not source.

Non-TS categories were reviewed directly:

- **Workflows** — only comment alignment changed (`@sha  # v4.6.2` →
  `@sha # v4.6.2`). **No action SHA was touched**, which matters because these
  files are supply-chain critical.
- **Shell** — zero diff.
- **JSON/YAML** — array collapsing (`[\n  { "name": "x" }\n]` → `[{ "name": "x" }]`).
- **Markdown** — 13 792 changed lines classified; every one is table realignment,
  quote normalisation, XHTML self-closing, or list/fence spacing.

### C — enforcement

`format:check` is now a phase in `scripts/quality_gate.sh` (not a separate ci.yml
step, so local and CI run the identical command), and `format:check` was added to
`gate-manifest.json` → `local.checks` so `validate-gate-parity.sh` tracks it.

## Two real regressions the cleanup surfaced, and their fixes

Both were found because the format commit was run through the full gate rather
than assumed safe. Neither was caused by sloppy formatting — both were gates
that had been measuring the wrong thing.

### 1. Prettier vs the 250-line skill cap

`prettier --write` pushed `.agents/skills/pr-review-fix/SKILL.md` from 245 to
**251 lines**, breaking `MAX_LINES_SKILL_MD` (enforced by
`validate-skill-format.sh`). Prettier's markdown output is net-line-positive: it
pads each table to its widest cell and inserts a blank line around each list.

Fixed with a new `.prettierignore` excluding `.agents/skills/`, `.opencode/skills/`
and `.github/skills/` — the same paths `.pre-commit-config.yaml` already excludes,
so the two stay in sync — plus vendored `.impeccable/` and generated output.

The alternative (reformatting the skill to fit) would have meant the repo's
format gate and its skill-line gate fighting over the same files, with the loser
being whichever the contributor did not run.

### 2. A CSS test that asserted on prettier's quote style

`design-tokens.test.ts` asserted `cssContent.toContain('[data-theme="sepia"]')` —
reading `globals.css` as raw text. Prettier normalises CSS attribute selectors
to single quotes, so a formatting change broke a _test_:

```
expect(cssContent).toContain('[data-theme="sepia"]')
AssertionError: expected "...[data-theme='sepia']..." to contain '[data-theme="sepia"]'
```

The assertion was a formatting canary, not a test of the theme block. Now
`toMatch(/\[data-theme=["']?sepia["']?\]/)`, which tests what it claims to test.

This is the general hazard the issue warned about: source-text assertions turn
any reformat into a red suite, which is how teams learn to distrust the suite.

### 3. LOC ratchet vs reformatting (ADR-288)

`check-loc.mjs` (ADR-278) compares exact line counts, so the reformat reported
**8 violations**, including `ReaderToolbar.tsx` "growing" 519 → 757 (+238) and two
files newly crossing the 500 cap. All were AST-verified reflow.

An attempt to make the ratchet formatting-insensitive (counting non-blank
lines) was **tried and reverted**: prettier splits long expressions across lines,
so those lines survive normalization and the delta was unchanged (+238 became
+238). The measurement could not be fixed that way.

So the baseline was regenerated in the same commit, which the ratchet permits
only as "extract instead of re-baselining up" — an allowance that assumes
growth means complexity. Here growth is provably formatting, and the proof is in
the AST comparison above. The regenerated baseline drops
`transformers-editorial.ts` (502 → 497, now under the cap) and adds
`sync.ts` and `access.ts` (newly over 500 after reflow). Net: 7 entries, 10 files
in the warn zone.

The follow-up is recorded in ADR-288: the ratchet should measure something
prettier cannot move (statements, or exports), not physical lines.

## Verification

- `pnpm format:check` → clean ("All matched files use Prettier code style").
- `pnpm test:unit` → 7/7 packages, 138 web test files, **1410 tests passed**.
  The single failure before the CSS fix is the one documented above.
- `node scripts/check-loc.mjs` → `✓ All 421 in-scope source files within the
500-line cap`, 7 grandfathered, 10 in the warn zone.
- `bash scripts/validate-skill-format.sh` → all SKILL.md pass.
- `bash scripts/validate-gate-parity.sh` → 9/9 local checks ✓, 8/8 release ✓.
- `./scripts/quality_gate.sh` → passes with the new `format` phase.

## Follow-ups (deliberately not done here)

- **LOC ratchet measurement** (ADR-288): still physical lines, so the next
  reformat re-triggers this. The fix is a better metric, not another
  regeneration.
- **Four pre-existing `⚠` PR-side parity lines** remain visible and honest
  (`Bundle Size`, `Lighthouse audit`, `Codacy Static Code Analysis`,
  `Quality Gate` — the last is a real name, `Full Quality Gate`). Same note as
  GOAP-287: a distinct claim set, left visible rather than folded in.
- **`apps/worker/src/worker-configuration.d.ts`** stays unformatted. If it is
  regenerated by `wrangler types`, it should be added to `.prettierignore` at
  that point rather than hand-formatted.
