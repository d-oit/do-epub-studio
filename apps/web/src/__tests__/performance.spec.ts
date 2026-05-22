import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Performance', () => {
  test('login page startup performance', async ({ page }) => {
    // Go to login page
    await page.goto('/login');

    // Wait for the login form to be visible
    await page.waitForSelector('form');

    // Measure FCP and other timing metrics
    const performanceTiming = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        fcp: fcp ? fcp.startTime : null,
        domInteractive: navigation.domInteractive,
        loadEventEnd: navigation.loadEventEnd,
      };
    });

    console.log(`FCP: ${performanceTiming.fcp}ms`);

    // 1500ms budget as per .performance-budgets.json
    expect(performanceTiming.fcp).toBeLessThan(1500);

    // Write to a temporary file for the CI reporter
    const metrics = {
      startupTime: {
        fcp: performanceTiming.fcp,
        domInteractive: performanceTiming.domInteractive,
        loadEventEnd: performanceTiming.loadEventEnd,
      }
    };

    // Write to a predictable location: either process.env.METRICS_OUTPUT or local file
    const outputPath = process.env.METRICS_OUTPUT || 'startup-metrics.json';
    fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
    console.log(`Metrics written to ${path.resolve(outputPath)}`);
  });
});
