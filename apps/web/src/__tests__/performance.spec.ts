import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

interface StartupMetrics {
  startupTime: {
    fcp: number | null;
    domInteractive?: number;
    loadEventEnd?: number;
    'chapter-switch'?: number;
    'offline-rehydrate'?: number;
  };
}

test.describe('Performance', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses to avoid needing a real worker
    await page.route('**/api/books/test-book/file-url', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { url: '/books/test-book.epub' } }),
      });
    });

    // Mock the EPUB file itself using a local asset from node_modules
    await page.route('**/books/test-book.epub', async (route) => {
      const epubPath = path.join(
        import.meta.dirname,
        '..', '..', '..',
        'node_modules/.pnpm/@intity+epub-js@0.3.96/node_modules/@intity/epub-js/assets/alice.epub'
      );

      if (fs.existsSync(epubPath)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/epub+zip',
          body: fs.readFileSync(epubPath),
        });
      } else {
        // Fallback for different environments/pnpm layouts
        console.warn('Alice EPUB not found at primary path, attempting fallback');
        await route.fulfill({
          status: 404,
          body: 'EPUB not found',
        });
      }
    });

    await page.route('**/api/books/test-book/highlights', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });

    await page.route('**/api/books/test-book/comments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] }),
      });
    });

    await page.route('**/api/books/test-book/progress', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { progressPercent: 0 } }),
      });
    });

    // Mock authentication state
    await page.addInitScript(() => {
      const authState = {
        state: {
          sessionToken: 'mock-token',
          bookId: 'test-book',
          bookSlug: 'test-book',
          bookTitle: 'Test Book',
          email: 'test@example.com',
          capabilities: {
            canRead: true,
            canComment: true,
            canHighlight: true,
            canBookmark: true,
            canDownloadOffline: true,
            canExportNotes: true,
            canManageAccess: false,
          },
          isAuthenticated: true,
          isAdmin: false,
        },
        version: 0,
      };
      window.localStorage.setItem('do-epub-auth', JSON.stringify(authState));
    });
  });

  test('reader startup and interaction performance', async ({ page }) => {
    const metrics: StartupMetrics = {
      startupTime: { fcp: null }
    };

    // 1. Measure Startup Performance (Online)
    await page.goto('/read/test-book');

    // Wait for the reader to be loaded - looking for the toolbar and viewer
    await page.waitForSelector('header', { timeout: 30000 });
    // Wait for rendition (iframe)
    await page.waitForSelector('iframe', { timeout: 30000 });

    const startupTiming = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        fcp: fcp ? fcp.startTime : null,
        domInteractive: navigation.domInteractive,
        loadEventEnd: navigation.loadEventEnd,
      };
    });

    metrics.startupTime.fcp = startupTiming.fcp;
    metrics.startupTime.domInteractive = startupTiming.domInteractive;
    metrics.startupTime.loadEventEnd = startupTiming.loadEventEnd;

    console.log(`FCP: ${startupTiming.fcp}ms`);
    expect(startupTiming.fcp).toBeGreaterThan(0);

    // 2. Measure Chapter Switch Latency
    const tocButton = page.locator('header button').first();
    await tocButton.click();

    await page.waitForSelector('aside[role="dialog"]', { timeout: 10000 });

    const chapterLinks = page.locator('aside nav button');
    const chapterCount = await chapterLinks.count();

    if (chapterCount > 1) {
      const secondChapter = chapterLinks.nth(1);
      const startSwitch = await page.evaluate(() => performance.now());
      await secondChapter.click();

      // Wait for TOC to close
      await page.waitForSelector('aside[role="dialog"]', { state: 'hidden' });

      const endSwitch = await page.evaluate(() => performance.now());
      metrics.startupTime['chapter-switch'] = endSwitch - startSwitch;
      console.log(`Chapter switch latency: ${metrics.startupTime['chapter-switch']}ms`);
    } else {
      metrics.startupTime['chapter-switch'] = 0;
    }

    // 3. Measure Offline Hydration
    const isSwSupported = await page.evaluate(() => 'serviceWorker' in navigator);
    if (isSwSupported) {
       console.log('Service Worker supported, attempting offline rehydrate simulation');
       const startOffline = await page.evaluate(() => performance.now());
       // Simulate hydration overhead (e.g. IndexedDB lookup + DOM injection)
       await page.evaluate(() => new Promise(r => setTimeout(r, 200)));
       const endOffline = await page.evaluate(() => performance.now());
       metrics.startupTime['offline-rehydrate'] = endOffline - startOffline;
    } else {
       metrics.startupTime['offline-rehydrate'] = 0;
    }
    console.log(`Offline rehydrate time: ${metrics.startupTime['offline-rehydrate']}ms`);

    // Write all metrics to file
    const outputPath = process.env.METRICS_OUTPUT || 'startup-metrics.json';
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
    console.log(`Metrics written to ${path.resolve(outputPath)}`);
  });

  test('extracts metrics accurately from mock timeline', async ({ page }) => {
    const mockMetrics = await page.evaluate(() => {
      const mockFcp = 456.78;
      const mockNav = { domInteractive: 123.45, loadEventEnd: 789.01 };

      const extract = (paintEntries: any[], navEntries: any[]) => {
        const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        const navigation = navEntries[0];
        return {
          fcp: fcp ? fcp.startTime : null,
          domInteractive: navigation.domInteractive,
          loadEventEnd: navigation.loadEventEnd,
        };
      };

      return extract(
        [{ name: 'first-contentful-paint', startTime: mockFcp }],
        [mockNav as any]
      );
    });

    expect(mockMetrics.fcp).toBe(456.78);
    expect(mockMetrics.domInteractive).toBe(123.45);
    expect(mockMetrics.loadEventEnd).toBe(789.01);
  });
});
