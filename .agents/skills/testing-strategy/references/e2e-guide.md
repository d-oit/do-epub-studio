---
name: e2e-guide
description: Playwright E2E testing guide for EPUB Studio
license: MIT
---

# Playwright E2E Testing Guide

## Setup

### Installation
```bash
npm init playwright@latest -- --lang=typescript
```

### Configuration
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Writing Tests

### Basic Test
```typescript
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('EPUB Studio');
});
```

### Form Submission
```typescript
test('can create new book', async ({ page }) => {
  await page.goto('/books/new');
  
  await page.fill('[name="title"]', 'My EPUB');
  await page.fill('[name="content"]', 'Sample content');
  await page.click('button[type="submit"]');
  
  await expect(page.url()).toContain('/books/');
});
```

### Authentication
```typescript
test('can login', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('.user-menu')).toBeVisible();
});
```

## Page Objects

### Example
```typescript
// pages/BookPage.ts
export class BookPage {
  constructor(private page: Page) {}
  
  async open(bookId: string) {
    await this.page.goto(`/books/${bookId}`);
  }
  
  getReader() {
    return this.page.locator('.reader');
  }
  
  async highlight(selector: string) {
    await this.page.click(selector);
    await this.page.click('button[aria-label="Highlight"]');
  }
}

// Usage
test('can highlight text', async ({ page }) => {
  const bookPage = new BookPage(page);
  await bookPage.open('book-1');
  
  await bookPage.highlight('.passage-1');
  
  await expect(page.locator('.highlight')).toBeVisible();
});
```

## Fixtures

### Custom Fixture
```typescript
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    
    await use(page);
  },
});

// Usage
test('can view books', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/books');
  await expect(authenticatedPage.locator('.book-card')).toHaveCount(3);
});
```

## Running Tests

### CLI Options
```bash
# Run all tests
pnpm playwright test

# Run specific file
pnpm playwright test e2e/books.spec.ts

# Run with UI
pnpm playwright test --ui

# Run with trace
pnpm playwright test --trace on

# Run in debug
pnpm playwright test --debug
```

### CI Configuration
```yaml
# .github/workflows/test.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm playwright install --with-deps
      - run: pnpm playwright test
```

## Best Practices

1. **Use semantically meaningful selectors**
   ```typescript
   // Good
   page.locator('button:has-text("Save")')
   page.getByLabel('Title')
   
   // Avoid
   page.locator('#submit-btn')
   page.locator('div:nth-child(3)')
   ```

2. **Clean up test data**
   ```typescript
   afterEach(async ({ page }) => {
     await cleanTestBooks(page);
   });
   ```

3. **Handle async operations**
   ```typescript
   // Wait for network idle
   await page.waitForLoadState('networkidle');
   
   // Wait for element
   await expect(page.locator('.loaded')).toBeVisible({ timeout: 5000 });
   ```

4. **Screenshot on failure**
   ```typescript
   test.afterEach(async ({ page }, testInfo) => {
     if (testInfo.status === 'failed') {
       await page.screenshot({ path: `screenshots/${testInfo.title}.png` });
     }
   });
   ```
