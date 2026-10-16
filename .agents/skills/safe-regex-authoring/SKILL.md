---
version: "1.0.0"
name: safe-regex-authoring
description: >
  Prevent ReDoS vulnerabilities in TypeScript/JavaScript regex authoring.
  Activates on any task touching RegExp, .test(), .match(), .exec(), .replace(), .split()
  with a regex literal. Enforces length guards and unambiguous patterns.
category: quality
allowed-tools: Read Write Edit Grep
license: MIT
---

# Safe Regex Authoring

Prevent ReDoS (Regular-expression Denial of Service) vulnerabilities.
Activated when you work with regex patterns or respond to CodeQL ReDoS alerts.

## When to Use

- Writing a new `RegExp` literal
- Adding `.test()`, `.match()`, `.exec()`, `.replace()`, or `.split()` with a regex
- Fixing a CodeQL `js/redos` or `js/polynomial-redos` alert
- Reviewing a PR with regex changes
- Editing CFI parsers, URL validators, or any annotation-text processing

## Three-Layer Defense

Every regex touching untrusted input MUST apply all three layers:

### 1. Length Guard (always first)

Reject input above a fixed cap before the regex runs:

```ts
const MAX_CFI_LENGTH = 1024;
if (cfi.length > MAX_CFI_LENGTH) return null;
```

### 2. Unambiguous Pattern

Rewrite repetitions so a single character class matches each position in exactly one way:

- `epubcfi\(\/[^)]+\)` → `epubcfi\([^)]{1,512}\)` (bounded, non-overlapping)
- `/\/+$/` → looped `str.endsWith('/')` to a fixed depth, or `str.replace(/\/$/, '')`
- Split complex patterns into multiple `String#startsWith` checks + bounded matches
- Prefer a hand-rolled tokenizer for CFI parsing over a single monolithic regex

### 3. Property-Based Fuzz

Use `fast-check` (already in the project) to assert every regex completes within 25ms for adversarial inputs up to `MAX_LENGTH`:

```ts
import fc from 'fast-check';

test('regex completes within time budget', () => {
  fc.assert(
    fc.property(fc.string({ maxLength: MAX_CFI_LENGTH }), (input) => {
      const start = performance.now();
      re.test(input);
      expect(performance.now() - start).toBeLessThan(25);
    }),
  );
});
```

## Mandatory Helpers

For any regex processing untrusted input, use `matchBounded` / `testBounded` / `matchAllBounded` from `@do-epub-studio/shared`:

```ts
import { matchBounded, testBounded, matchAllBounded } from '@do-epub-studio/shared';

// Instead of: re.exec(input)
const result = matchBounded(re, input, MAX_CFI_LENGTH);

// Instead of: re.test(input)
const hasMatch = testBounded(re, input, MAX_CFI_LENGTH);

// Instead of: [...input.matchAll(re)] for iterative matches
const allMatches = matchAllBounded(re, input, MAX_CFI_LENGTH);
```

These helpers reject inputs exceeding `maxLen` before the regex engine runs.
See `packages/shared/src/safe-regex.ts` for the implementation.

## CodeQL Alert Remediation

Every CodeQL ReDoS alert MUST be fixed at the source — never dismissed:

1. Identify the regex and the input surface (untrusted? always guard)
2. Apply length guard (layer 1)
3. Rewrite pattern to eliminate ambiguity (layer 2)
4. Add property-based test (layer 3)
5. Verify with `pnpm test --filter <affected-package>`
6. Confirm the alert moves to `state: fixed` via `gh api repos/<owner>/<repo>/code-scanning/alerts`

## Quick Check

- [ ] Input length guarded before regex runs
- [ ] Pattern has no overlapping/ambiguous repetitions
- [ ] Uses `matchBounded`/`testBounded`/`matchAllBounded` for untrusted input
- [ ] Property-based fuzz test added for adversarial inputs
- [ ] CodeQL alert confirmed fixed (not dismissed)

## References

- ADR-034: ReDoS Hardening Policy — `plans/034-adr-security-redos-hardening.md`
- `docs/security.md` § ReDoS Hardening
- `packages/shared/src/safe-regex.ts` — `matchBounded` / `testBounded` implementation
- AGENTS.md Tier 1: "MUST guard every regex against untrusted input using matchBounded/testBounded from @do-epub-studio/shared per ADR-034"

## Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "The input comes from our own parser, so no length guard is needed." | The Three-Layer Defense applies to every regex touching untrusted input: length guard first, unambiguous pattern second, fuzz test third. Any annotation/CFI/URL surface counts as untrusted. |
| "The CodeQL alert is a false positive — I'll dismiss it." | Every ReDoS alert MUST be fixed at the source and confirmed at `state: fixed` via `gh api repos/<owner>/<repo>/code-scanning/alerts`; dismissing it is not remediation. |
| "`re.test(input)` is the same as `testBounded(re, input, MAX_CFI_LENGTH)`." | The `matchBounded`/`testBounded`/`matchAllBounded` helpers reject over-length input *before* the regex engine runs; the bare methods do not, which is exactly the ReDoS window. |
| "`/\/+$/` is tiny, it can't backtrack pathologically." | Overlapping repetitions are the polynomial case: rewrite to a looped `str.endsWith('/')` or `str.replace(/\/$/, '')`, or bound the repetition (`epubcfi\([^)]{1,512}\)`). |
| "The 25ms fuzz budget is flaky in CI, skip it." | Layer 3 requires a `fast-check` property asserting every regex completes under 25ms for adversarial inputs up to `MAX_LENGTH` — that test is the regression guard, not a nicety. |

## Red Flags

- [ ] Regex applied to request/EPUB/user input with no length check before it runs.
- [ ] Nested or overlapping quantifiers (`(a+)+`, `/\/+$/`, unbounded `[^)]+`) left in the pattern.
- [ ] `re.test`/`re.exec`/`input.matchAll(re)` called directly on untrusted input instead of the bounded helpers.
- [ ] CodeQL `js/redos` alert dismissed rather than moved to `state: fixed`.
- [ ] Regex change merged with no `fast-check` property test for adversarial input.
- [ ] Fix verified without `pnpm test --filter <affected-package>`.

## Integration

- **security-code-auditor**: For broader security reviews
- **code-quality**: For general code-smell remediation alongside regex fixes
- **testdata-builders**: For generating adversarial test inputs
