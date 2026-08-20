import { type Page, expect } from '@playwright/test';

/** Standard viewport sizes for regression testing. */
export const VIEWPORT_MATRIX = [
  { label: 'mobile-sm', width: 320, height: 568 },
  { label: 'mobile-md', width: 375, height: 812 },
  { label: 'mobile-lg', width: 390, height: 844 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'laptop', width: 1024, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'large-desktop', width: 1920, height: 1080 },
  { label: 'landscape-mobile', width: 812, height: 375 },
] as const;

export type Viewport = (typeof VIEWPORT_MATRIX)[number];

/**
 * Assert no horizontal overflow and visible key elements across all viewports.
 * Call this from any E2E test to verify responsive behavior.
 */
export async function assertViewportMatrix(
  page: Page,
  url: string,
  opts: {
    /** Selectors that must be visible at every viewport. */
    required?: string[];
    /** Additional per-viewport assertions. */
    assertAtEachViewport?: (page: Page, viewport: Viewport) => Promise<void>;
  } = {},
): Promise<void> {
  for (const viewport of VIEWPORT_MATRIX) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Core invariant: no horizontal scroll
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${viewport.label} (${viewport.width}x${viewport.height}): no horizontal overflow`).toBe(false);

    // Required elements visible
    for (const selector of opts.required ?? []) {
      const el = page.locator(selector).first();
      await expect(
        el,
        `${viewport.label}: ${selector} should be visible`,
      ).toBeVisible({ timeout: 5000 });
    }

    // Custom per-viewport assertions
    if (opts.assertAtEachViewport) {
      await opts.assertAtEachViewport(page, viewport);
    }
  }
}
