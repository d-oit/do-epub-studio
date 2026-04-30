# Plan 014: Fast-Check Skill Integration & Testing Enhancement

## Executive Summary

This plan covers the integration of fast-check's `javascript-testing-expert` skill and our own property-based testing approach for do-epub-studio.

---

## Background

### Fast-Check's javascript-testing-expert Skill

The fast-check repository includes a comprehensive skill at:
`https://github.com/dubzzz/fast-check/blob/main/skills/javascript-testing-expert/SKILL.md`

**Key features (402 lines):**
- AAA pattern guidelines
- Property-based testing when to use
- `@fast-check/vitest` integration
- Race condition testing with `fc.scheduler()`
- Faker integration with fast-check
- Detailed code examples

### Our Current Testing Skills

| Skill | Focus | Status |
|-------|-------|--------|
| `testing-strategy` | Test planning, pyramid, coverage goals | Existing |
| `testdata-builders` | Test data factories | Existing |

**Gap:** Neither skill covers property-based testing (PBT) with fast-check.

---

## Analysis

### What fast-check Skill Provides

| Area | Coverage |
|------|----------|
| Test structure | ✅ AAA pattern, naming conventions |
| Property-based testing | ✅ When/how to use |
| Fast-check integration | ✅ @fast-check/vitest |
| Race conditions | ✅ fc.scheduler() |
| Faker integration | ✅ Code snippet provided |
| Edge cases | ✅ Detailed examples |

### What Our Project Needs

| Need | Source |
|------|--------|
| PBT for auth security | Plan 013 - create new tests |
| Schema edge case testing | Plan 013 - create new tests |
| Locator parsing tests | Plan 013 - create new tests |
| Integration with our testkit | Custom adaptation needed |

---

## Recommendations

### Option A: Create Adapted Skill (Recommended) ✅

Create a new skill `.agents/skills/property-based-testing/SKILL.md` that:
1. Imports best practices from fast-check skill
2. Adds project-specific examples (our auth, schemas, locator)
3. References our existing test structure
4. Integrates with `testdata-builders` skill

**Implementation:**
```bash
# Create skill directory
mkdir -p .agents/skills/property-based-testing

# Skill will reference:
# - fast-check's javascript-testing-expert (import best practices)
# - Plan 013 (implementation details)
# - packages/testkit (test data builders)
```

### Option B: Update Existing Skills

Add PBT section to `testing-strategy` skill:
- Reference fast-check skill
- Add our project-specific examples

**Changes needed:**
- Update `.agents/skills/testing-strategy/SKILL.md`
- Add PBT coverage examples

---

## Implementation Plan

### Phase 1: Skill Creation

- [ ] Create `.agents/skills/property-based-testing/SKILL.md`
- [ ] Document when to use PBT vs example-based tests
- [ ] Add project-specific arbitraries
- [ ] Reference fast-check skill for comprehensive guidelines

### Phase 2: Tooling Setup

From Plan 013:
- [ ] Install fast-check in packages
- [ ] Install @fast-check/vitest for better integration
- [ ] Create shared arbitraries file

### Phase 3: Test Migration

- [ ] Identify existing tests that could benefit from PBT
- [ ] Add property-based tests to security-critical areas
- [ ] Update documentation in agents-docs/

---

## Project-Specific Arbitraries

Based on our codebase, we need custom arbitraries:

```do-epub-studio/packages/shared/src/__tests__/arbitraries.ts
import * as fc from 'fast-check';

// Book-related arbitraries
export const BookSlugArbitrary = fc
  .string({ minLength: 1, maxLength: 255 })
  .filter(s => /^[a-z0-9-]+$/.test(s));

export const BookVisibilityArbitrary = fc.oneof(
  fc.constant('private'),
  fc.constant('public'),
  fc.constant('password_protected'),
);

// Auth arbitraries
export const HexTokenArbitrary = fc
  .hexaString({ minLength: 64, maxLength: 64 });

export const EmailArbitrary = fc.emailAddress();

// Reader arbitraries
export const CfiArbitrary = fc
  .string()
  .map(cfi => `epubcfi(/6/${cfi})`);

export const HexColorArbitrary = fc
  .string({ minLength: 7, maxLength: 7 })
  .map(c => c.startsWith('#') ? c : `#${c}`)
  .filter(c => /^#[0-9a-f]{6}$/i.test(c));

// Grant arbitraries
export const GrantModeArbitrary = fc.oneof(
  fc.constant('private'),
  fc.constant('password_protected'),
  fc.constant('reader_only'),
);

export const CapabilityArbitrary = fc.record({
  allowed: fc.boolean(),
  comments_allowed: fc.boolean(),
  offline_allowed: fc.boolean(),
});
```

---

## Usage Guidelines (for the Skill)

### When to Use Property-Based Testing

Use PBT for:
- ✅ Security boundary functions (auth, validation)
- ✅ String parsing (locator, CFI)
- ✅ Schema edge cases
- ✅ "Should always/never" properties

Use Example-Based Testing for:
- ✅ Specific important scenarios (documentation)
- ✅ Complex integration flows
- ✅ E2E user journeys

### Integration with Testdata Builders

The skill should work with `testdata-builders` skill:

```typescript
// Combine PBT with our test builders
import { makeGrant, makeSession } from '@do-epub-studio/testkit';

fc.assert(
  fc.property(
    fc.integer({ min: 1, max: 100 }), // number of grants
    (count) => {
      const grants = Array.from({ length: count }, () => makeGrant());
      // Test bulk operations
      expect(grants.length).toBe(count);
    }
  )
);
```

---

## References

- Fast-check skill: `https://github.com/dubzzz/fast-check/blob/main/skills/javascript-testing-expert/SKILL.md`
- Plan 013: Fast-Check Property Testing Integration
- Existing skill: `.agents/skills/testing-strategy/SKILL.md`
- Existing skill: `.agents/skills/testdata-builders/SKILL.md`
- AGENTS.md: Testing guidelines

---

## Dependencies

- Plan 012: Testing gaps (T-1 through T-4)
- Plan 013: Fast-check implementation details
- Existing skills: testing-strategy, testdata-builders
