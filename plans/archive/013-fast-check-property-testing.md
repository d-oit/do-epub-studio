# Plan 013: Fast-Check Property-Based Testing Integration

## Executive Summary

This plan covers the integration of [fast-check](https://github.com/dubzzz/fast-check) property-based testing library into the do-epub-studio codebase. Property-based testing (PBT) generates thousands of test cases automatically, finding edge cases that example-based testing misses.

**Why fast-check?**
- 4.9k GitHub stars, trusted by jest, jasmine, fp-ts, ramda
- Strong TypeScript support
- Smart shrinking to minimal counterexamples
- Biased by default for better edge case discovery

---

## Current State

| Area | Current Testing | Opportunity |
|------|-----------------|-------------|
| `apps/worker/src/auth/` | Basic example tests | **High** - Security critical |
| `packages/shared/src/schemas.ts` | Limited validation | **High** - Edge cases |
| `packages/reader-core/` | Minimal tests | **High** - Complex parsing |
| API Routes | Example-based only | **Medium** - Input validation |

---

## Benefits Analysis

### 1. Security Functions - Highest Priority

**Files:** `apps/worker/src/auth/password.ts`, `apps/worker/src/auth/middleware.ts`

Property-based testing can expose:
- Malformed auth header injection attempts
- Token parsing edge cases
- Password validation bypass attempts

```do-epub-studio/apps/worker/src/__tests__/auth.pbt.test.ts
import fc from 'fast-check';

// Property: parseAuthHeader never throws on any input
fc.assert(
  fc.property(fc.string(), (header) => {
    const result = parseAuthHeader(header);
    // Should never crash, always return valid result
    expect(result === null || typeof result === 'string').toBe(true);
  }),
  { numRuns: 1000 }
);
```

### 2. Schema Validation - High Priority

**Files:** `packages/shared/src/schemas.ts`

Zod schemas define security boundaries. PBT can:
- Generate thousands of valid/invalid inputs
- Verify regex patterns accept/reject correctly
- Test edge cases in refinement logic

```do-epub-studio/packages/shared/src/__tests__/schemas.pbt.test.ts
// Property: CreateBookSchema rejects ALL invalid slugs
fc.assert(
  fc.property(
    fc.string().filter(s => !/^[a-z0-9-]+$/.test(s)),
    (slug) => {
      const result = CreateBookSchema.safeParse({
        title: 'Title',
        slug: slug,
      });
      expect(result.success).toBe(false);
    }
  ),
  { numRuns: 1000 }
);
```

### 3. Reader Core - Complex Parsing

**Files:** `packages/reader-core/src/locator.ts`, `packages/reader-core/src/reanchor.ts`

Complex string manipulation has many edge cases:
- CFI parsing edge cases
- Unicode normalization
- Prototype pollution attempts

```do-epub-studio/packages/reader-core/src/__tests__/locator.pbt.test.ts
// Property: parseLocator(locatorToString(x)) === x
fc.assert(
  fc.property(fc.lorem(), (text) => {
    const locator = { cfi: 'epubcfi(/6/4)', textExcerpt: text };
    const serialized = locatorToString(locator);
    const parsed = parseLocator(serialized);
    expect(parsed).toEqual(locator);
  })
);
```

---

## Integration Plan

### Phase 1: Infrastructure (Week 1)

**Tasks:**
- [ ] Install fast-check in packages
- [ ] Create shared arbitraries file
- [ ] Add to vitest config if needed

**Installation:**
```bash
cd packages/shared && pnpm add -D fast-check
cd apps/worker && pnpm add -D fast-check
cd packages/reader-core && pnpm add -D fast-check
```

**Shared arbitraries:**
```do-epub-studio/packages/shared/src/__tests__/arbitraries.ts
import * as fc from 'fast-check';

export const BookSlugArbitrary = fc
  .string({ minLength: 1, maxLength: 255 })
  .filter(s => /^[a-z0-9-]+$/.test(s));

export const HexTokenArbitrary = fc
  .hexaString({ minLength: 64, maxLength: 64 });

export const CfiArbitrary = fc
  .string()
  .map(cfi => `epubcfi(/6/${cfi})`);
```

### Phase 2: Security Tests (Week 2)

**Priority P0 - Must Have:**

| Test | File | Property |
|------|------|----------|
| Password validation safety | `auth/password.ts` | Never throws, always returns boolean |
| Token generation uniqueness | `auth/session.ts` | All tokens unique, correct format |
| Auth header parsing | `auth/middleware.ts` | Handles all malformed input |
| Schema validation | `schemas.ts` | Accepts valid, rejects invalid |

### Phase 3: Core Logic Tests (Week 3)

**Priority P1 - Should Have:**

| Test | File | Property |
|------|------|----------|
| Locator round-trip | `locator.ts` | parse(stringify(x)) === x |
| Reanchor idempotence | `reanchor.ts` | normalize(normalize(x)) === normalize(x) |
| CFI parsing safety | `locator.ts` | Never throws |

### Phase 4: Coverage Expansion (Week 4)

**Priority P2 - Nice to Have:**

- All remaining schema edge cases
- Route handler input validation
- State machine transitions

---

## Test Coverage Impact

### Current Coverage (from Plan 012)

| Type | Current | Target |
|------|---------|--------|
| Business Logic | ~70% | 90%+ |
| Security Functions | ~60% | 100% |
| Validation Logic | ~50% | 95% |

### Expected Improvement with PBT

- **Security boundaries**: +40% coverage (100% edge case coverage)
- **Schema validation**: +45% (comprehensive input testing)
- **Overall**: +15-20% total coverage

---

## Code Examples

### Example 1: Auth Header Parsing

```do-epub-studio/apps/worker/src/__tests__/routes.auth-headers.pbt.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseAuthHeader } from '../auth/middleware';

describe('parseAuthHeader property tests', () => {
  // Property: never throws on any input
  it('is safe with any string input', () => {
    fc.assert(
      fc.property(fc.string(), (header) => {
        expect(() => parseAuthHeader(header)).not.toThrow();
      }),
      { numRuns: 1000 }
    );
  });

  // Property: only accepts valid Bearer tokens
  it('rejects non-Bearer formats', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant('BEARER'),
          fc.constant('Bearer'),
          fc.constant('Basic ABC'),
          fc.lorem(),
        ),
        (header) => {
          const result = parseAuthHeader(header);
          // Must start with 'Bearer ' to be valid
          if (!header.startsWith('Bearer ')) {
            expect(result).toBeNull();
          }
        }
      )
    );
  });

  // Property: valid tokens have correct format
  it('valid tokens produce correct format', () => {
    fc.assert(
      fc.property(fc.hexaString({ minLength: 32, maxLength: 128 }), (token) => {
        const result = parseAuthHeader(`Bearer ${token}`);
        expect(result).toBe(token);
      })
    );
  });
});
```

### Example 2: Schema Edge Cases

```do-epub-studio/packages/shared/src/__tests__/CreateBookSchema.pbt.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { CreateBookSchema } from '../schemas';

describe('CreateBookSchema property tests', () => {
  // Property: all valid slugs accepted
  it('accepts all valid slug patterns', () => {
    fc.assert(
      fc.property(BookSlugArbitrary, (slug) => {
        const result = CreateBookSchema.safeParse({
          title: 'Valid Title',
          slug: slug,
        });
        expect(result.success).toBe(true);
      })
    );
  });

  // Property: all invalid slugs rejected
  it('rejects all invalid slug patterns', () => {
    fc.assert(
      fc.property(
        fc.string()
          .filter(s => !/^[a-z0-9-]+$/.test(s) && s.length > 0),
        (slug) => {
          const result = CreateBookSchema.safeParse({
            title: 'Title',
            slug: slug,
          });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });

  // Property: language is exactly 2 chars
  it('enforces exactly 2-character language codes', () => {
    fc.assert(
      fc.property(fc.string(), (lang) => {
        const result = CreateBookSchema.safeParse({
          title: 'Title',
          slug: 'valid',
          language: lang,
        });
        const isValid = lang.length === 2 && /^[a-z]{2}$/i.test(lang);
        expect(result.success).toBe(isValid);
      }),
      { numRuns: 1000 }
    );
  });
});
```

---

## Migration Checklist

- [ ] Install fast-check in shared package
- [ ] Install fast-check in worker package
- [ ] Install fast-check in reader-core package
- [ ] Create `packages/shared/src/__tests__/arbitraries.ts`
- [ ] Add auth/security PBT tests (P0)
- [ ] Add schema validation PBT tests (P0)
- [ ] Add locator/reader PBT tests (P1)
- [ ] Document PBT patterns in agents-docs/LEARNINGS.md
- [ ] Update testing strategy in Plan 012

---

## References

- Fast-Check GitHub: https://github.com/dubzzz/fast-check
- Fast-Check Documentation: https://fast-check.dev/
- **Fast-Check Skill**: https://github.com/dubzzz/fast-check/blob/main/skills/javascript-testing-expert/SKILL.md
- Plan 012: Comprehensive Analysis Findings
- Plan 014: Fast-Check Skill Integration (for skill creation)
- Testing Strategy: testing-strategy skill
- Current test files: `apps/worker/src/__tests__/`, `packages/shared/src/__tests__/`

---

## Dependencies

- **Plan 012**: Contains testing gap analysis (T-1 through T-4)
- **Plan 011**: Quality gate scripts
- **AGENTS.md**: Max 500 LOC per file rule applies to test files too
