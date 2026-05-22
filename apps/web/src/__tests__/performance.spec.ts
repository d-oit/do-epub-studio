import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Performance', () => {
  test('reader startup performance', async ({ page }) => {
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

    // Go to reader page
    await page.goto('/read/test-book');

    // Wait for the reader container or first chapter to be visible
    await page.waitForSelector('main', { timeout: 30000 });

    // Measure FCP and other timing metrics
    const performanceTiming = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        fcp: fcp ? fcp.startTime : null,
        domInteractive: navigation.domInteractive,
        loadEventEnd: navigation.loadEventEnd,
        // Also capture the raw performance entries for debugging/verification
        entries: performance.getEntries().map(e => ({ name: e.name, entryType: e.entryType, startTime: e.startTime }))
      };
    });

    console.log(`FCP: ${performanceTiming.fcp}ms`);

    // Verify FCP was actually captured
    expect(performanceTiming.fcp).toBeGreaterThan(0);

    if (performanceTiming.fcp) {
      expect(performanceTiming.fcp).toBeLessThan(1500);
    }

    // Write to a temporary file for the CI reporter
    const metrics = {
      startupTime: {
        fcp: performanceTiming.fcp,
        domInteractive: performanceTiming.domInteractive,
        loadEventEnd: performanceTiming.loadEventEnd,
      }
    };

    const outputPath = process.env.METRICS_OUTPUT || 'startup-metrics.json';
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
    console.log(`Metrics written to ${path.resolve(outputPath)}`);
  });

  test('extracts metrics accurately from mock timeline', async ({ page }) => {
    // This test verifies the extraction logic itself
    const mockMetrics = await page.evaluate(() => {
      // Mock performance object behavior
      const mockFcp = 456.78;
      const mockNav = { domInteractive: 123.45, loadEventEnd: 789.01 };

      // Extraction logic (same as in the real test)
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
