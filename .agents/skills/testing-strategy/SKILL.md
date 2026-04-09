---
version: "1.0.0"
name: testing-strategy
description: >
  Plan test coverage for features. Activate for test pyramid design,
  Vitest/Playwright strategy, and coverage goal setting.
category: quality
allowed-tools: Read Grep Glob
license: MIT
---

# Testing Strategy

Design and implement comprehensive testing strategies for EPUB Studio.
Focus on **planning** what to test and **when**.
For test data builders, use the `testdata-builders` skill.

## When to Use

- Test planning for new features
- Deciding test pyramid ratios
- Vitest unit test strategy
- Playwright E2E coverage planning
- Coverage gap analysis

## Test Pyramid

```
       /\
      /  \
     / E2E \      <- 10% (critical paths)
    /--------\
   /Integration\  <- 20% (API, DB)
  /--------------\
 /     Unit       \ <- 70% (business logic)
/------------------\
```

## EPUB Studio Stack

### Unit Tests (Vitest)
```typescript
// Test business logic
import { describe, it, expect } from 'vitest';

describe('Permission Logic', () => {
  it('grants access to book owner', () => {
    const hasAccess = checkAccess(ownerId, bookId);
    expect(hasAccess).toBe(true);
  });
});
```

### Integration Tests
```typescript
// Test database operations
import { describe, it, expect, beforeAll } from 'vitest';

describe('Turso DB', () => {
  beforeAll(async () => {
    await setupTestDB();
  });
  
  it('creates book permission', async () => {
    const grant = await createGrant(userId, bookId, 'read');
    expect(grant.book_id).toBe(bookId);
  });
});
```

### E2E Tests (Playwright)
```typescript
// Test user flows
import { test, expect } from '@playwright/test';

test('user can read a book', async ({ page }) => {
  await page.goto('/books/test-book');
  await expect(page.locator('.reader')).toBeVisible();
});
```

## Coverage Goals

| Type | Target |
|------|--------|
| Business Logic | > 90% |
| API Routes | > 80% |
| UI Components | > 70% |
| Overall | > 80% |

## Quality Checklist

- [ ] Unit tests for business logic
- [ ] Integration tests for DB/API
- [ ] E2E tests for critical paths
- [ ] Coverage tracking
- [ ] No skipped tests for core flows

## Related Skills

- **testdata-builders** — For deterministic test data builders.

## References

- `references/test-patterns.md` - Common patterns
- `references/e2e-guide.md` - Playwright setup
