---
version: "1.0.0"
name: testing-strategy
description: Design comprehensive testing strategies for EPUB Studio. Use for test planning, Vitest unit tests, Playwright E2E tests, property-based testing, and coverage analysis.
license: MIT
---

# Testing Strategy

Design and implement comprehensive testing strategies for EPUB Studio.

## When to Use

- Test planning for new features
- Writing unit tests (Vitest)
- Writing E2E tests (Playwright)
- Coverage analysis
- Test data builders

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

## Test Data Builders

Create builders for:
- Books
- Users
- Permissions (grants)
- Sessions
- Comments
- Highlights

```typescript
// Example: BookBuilder
class BookBuilder {
  private data = { title: 'Test', author: 'Author' };
  
  withTitle(title: string) {
    this.data.title = title;
    return this;
  }
  
  build() {
    return createBook(this.data);
  }
}

// Usage
const book = await new BookBuilder()
  .withTitle('My EPUB')
  .build();
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
- [ ] Test data builders
- [ ] Coverage tracking
- [ ] No skipped tests for core flows

## References

- `references/test-patterns.md` - Common patterns
- `references/e2e-guide.md` - Playwright setup
