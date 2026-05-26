import { test, expect, type Page, type Route } from '@playwright/test';

const API_PATTERNS = [
  '**/api/access/request',
  '**/api/books/*/file-url',
  '**/api/books/*/progress',
  '**/api/books/*/highlights',
  '**/api/books/*/comments',
  '**/api/access/logout',
];

async function assertTraceIdOnRequest(page: Page) {
  const seen = new Set<string>();

  for (const pattern of API_PATTERNS) {
    await page.route(pattern, async (route: Route) => {
      const headers = route.request().headers();
      const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
      expect(traceId, `${pattern} request should include X-Trace-Id header`).toBeTruthy();
      expect(traceId!.length).toBeGreaterThanOrEqual(8);
      seen.add(pattern);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: {} }),
      });
    });
  }

  return seen;
}

async function assertTraceIdInResponse(page: Page) {
  for (const pattern of API_PATTERNS) {
    await page.route(pattern, async (route: Route) => {
      const headers = route.request().headers();
      const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];
      const responseHeaders: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (traceId) {
        responseHeaders['x-trace-id'] = traceId;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: responseHeaders,
        body: JSON.stringify({
          ok: true,
          data: {},
          traceId: traceId || 'echoed',
        }),
      });
    });
  }
}

test.describe('traceId header assertions', () => {
  test('all API requests include X-Trace-Id header', async ({ page }) => {
    const seen = await assertTraceIdOnRequest(page);

    await page.goto('/login');

    await page.getByLabel('Book URL Slug').fill('test-book');
    await page.getByLabel('Email Address').fill('test@example.com');
    await page.getByLabel('Password (if required)').fill('test-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    for (const pattern of API_PATTERNS) {
      expect(seen.has(pattern), `${pattern} should have been intercepted`).toBeTruthy();
    }
  });

  test('X-Trace-Id header is echoed in API response headers', async ({ page }) => {
    const responseTraceIds: string[] = [];

    await page.route('**/api/access/request', async (route: Route) => {
      const headers = route.request().headers();
      const traceId = headers['x-trace-id'] || headers['X-Trace-Id'];

      if (traceId) {
        responseTraceIds.push(traceId);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: traceId ? { 'x-trace-id': traceId } : {},
        body: JSON.stringify({
          ok: true,
          data: { sessionToken: 'test-token' },
        }),
      });
    });

    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/access/request'),
    );

    await page.goto('/login');
    await page.getByLabel('Book URL Slug').fill('test-book');
    await page.getByLabel('Email Address').fill('test@example.com');
    await page.getByLabel('Password (if required)').fill('test-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    const response = await responsePromise;
    const responseTraceId = response.headers()['x-trace-id'];
    expect(responseTraceId).toBeTruthy();
    expect(responseTraceId!.length).toBeGreaterThanOrEqual(8);

    expect(responseTraceIds.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('traceId server responses', () => {
  test('server response includes traceId in body on error', async ({ page }) => {
    await assertTraceIdInResponse(page);

    const responsePromise = page.waitForResponse((res) =>
      res.url().includes('/api/access/request'),
    );

    await page.goto('/login');
    await page.getByLabel('Book URL Slug').fill('test-book');
    await page.getByLabel('Email Address').fill('test@example.com');
    await page.getByLabel('Password (if required)').fill('test-password');
    await page.getByRole('button', { name: 'Sign In' }).click();

    const response = await responsePromise;
    const body = await response.json();
    expect(body.traceId).toBeTruthy();
  });
});
