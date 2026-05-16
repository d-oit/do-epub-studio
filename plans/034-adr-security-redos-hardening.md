# ADR-034: ReDoS Hardening Policy

**Status:** Proposed
**Date:** 2026-05-17
**Supersedes:** none
**Related:** Plan 033 (Group A + D), AGENTS.md Tier 1 ("MUST not skip tests for core permission, sync, or auth flows"), `docs/security.md`

---

## Context

CodeQL flagged **5 open high-severity** Regular-expression Denial of Service (ReDoS) findings on `main @ 5cc1475`:

| # | Rule | File | Surface |
|---|---|---|---|
| 5 | `js/redos` (error) | `packages/reader-core/src/epub-loader.ts:301` | `isValidCfi` — exponential backtracking on `epubcfi(/9/...)` |
| 4 | `js/polynomial-redos` | `packages/schema/src/locator.ts:44` | `cfiToRange` — polynomial on `!\]!` repetition |
| 3 | `js/polynomial-redos` | `packages/reader-core/src/epub-loader.ts:301` | duplicate of #5, different path class |
| 2 | `js/polynomial-redos` | `packages/reader-core/src/epub-loader.ts:296` | `extractCfi` — polynomial on `epubcfi(/` repeats |
| 1 | `js/polynomial-redos` | `apps/worker/src/routes/admin.ts:91` | `/\/+$/` trailing-slash trim on `APP_BASE_URL` (low risk but flagged) |

All five regexes consume **untrusted input**: client-supplied annotation locators, EPUB CFI strings extracted from book content, and admin-configured base URLs. A malicious EPUB or annotation payload can cause Worker CPU exhaustion (Cloudflare Worker CPU time hard-limit = 30s wall, but billable and budget-impacting), and on the web client can freeze the rendering thread.

The project has no standing policy for safe-regex authoring, no CI gate to keep the CodeQL alert count at zero, and no agent skill that flags ambiguous repetition patterns at authoring time.

---

## Decision

### 1. Remediate, never dismiss

Every CodeQL ReDoS alert MUST be fixed at the source. Dismissal (`reviewed → won't fix`) is **prohibited** unless an alternative ADR documents an explicit risk acceptance reviewed by a maintainer.

### 2. Defense in depth — three layers

For every regex that touches untrusted input:

1. **Length guard first.** Reject input above a fixed cap before the regex runs:
   ```ts
   const MAX_CFI_LENGTH = 1024;
   if (cfi.length > MAX_CFI_LENGTH) return null;
   ```
2. **Unambiguous pattern.** Rewrite repetitions so a single character class matches each position in exactly one way. Examples:
   - `epubcfi\(\/[^)]+\)` → `epubcfi\([^)]{1,512}\)` (bounded, non-overlapping).
   - `^epubcfi\(\/\d+(?:\[\S+\])?(?:\/[^)]+)*\)$` → split into two `String#startsWith` + bounded matches, or a hand-rolled tokenizer in `packages/reader-core/src/cfi-parser.ts`.
   - `/\/+$/` → `while (str.endsWith('/')) str = str.slice(0, -1);` or `str.replace(/\/$/, '')` looped to a fixed depth.
3. **Property-based fuzz.** Use `fast-check` (already adopted — see Plan 013/014) to assert every regex completes within a wall-clock budget (e.g. 25ms) for adversarial inputs up to `MAX_LENGTH`.

### 3. New helper module

Introduce `packages/shared/src/safe-regex.ts` exposing:

```ts
export function matchBounded(re: RegExp, input: string, maxLen: number): RegExpExecArray | null
export function testBounded(re: RegExp, input: string, maxLen: number): boolean
```

Every call site in `packages/reader-core`, `packages/schema`, and `apps/worker` MUST go through this helper for inputs whose provenance is not internal.

### 4. CI gate

Add a job to `.github/workflows/ci.yml`:

```yaml
- name: Fail on open CodeQL alerts
  run: |
    count=$(gh api repos/${{ github.repository }}/code-scanning/alerts?state=open --jq 'length')
    [ "$count" = "0" ] || { echo "::error::Open CodeQL alerts: $count"; exit 1; }
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This complements (does not replace) the existing CodeQL workflow.

### 5. New agent skill — `safe-regex-authoring`

Create `.agents/skills/safe-regex-authoring/SKILL.md` (per `skill-creator` skill, ≤250 lines) that:

- Activates on any task touching `RegExp`, `.test(`, `.match(`, `.exec(`, `.replace(`, `.split(` with a regex literal.
- Requires the three-layer remediation above before allowing a commit.
- Cross-references this ADR.

### 6. AGENTS.md tier promotion

Add a new bullet to AGENTS.md Tier 1:

> - **MUST guard every regex against untrusted input** using `matchBounded` / `testBounded` from `@do-epub-studio/shared` per ADR-034.

---

## Consequences

### Positive

- Hard upper bound on regex work, eliminating Worker CPU DoS surface.
- CI gate prevents regression; future CodeQL flags block merge.
- New skill catches the class at authoring time, not at CodeQL run.

### Negative

- Marginal CPU cost for the length check on every parse (~microseconds, negligible).
- Refactor cost: ≈ 5 call sites + new helper + tests.
- Property tests increase Vitest runtime ≈ 1–2s.

### Risks

- A `MAX_CFI_LENGTH` of 1024 may reject pathologically long but valid CFI; mitigated by spec analysis — EPUB 3 CFI rarely exceeds 256 bytes.
- The CI gate could block legitimate WIP if a transient CodeQL false-positive lands; mitigated by the dismissal-via-ADR escape hatch.

---

## Validation

- All 5 alerts in §Context return `state: fixed` from `gh api .../code-scanning/alerts`.
- `pnpm test --filter @do-epub-studio/shared --filter @do-epub-studio/reader-core` passes including new property tests.
- New CI gate runs and reports 0 alerts.
- AGENTS.md Tier 1 bullet rendered in the next compliance self-check.
