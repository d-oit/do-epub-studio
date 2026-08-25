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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks if two bounding rectangles intersect.
 */
export function rectanglesIntersect(first: Rect, second: Rect): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

/**
 * Checks if a child rectangle is completely contained within a container rectangle.
 * Allows a small tolerance (default 0.5px) for subpixel rounding.
 */
export function isContainedIn(child: Rect, container: Rect, tolerance = 0.5): boolean {
  return (
    child.x >= container.x - tolerance &&
    child.y >= container.y - tolerance &&
    child.x + child.width <= container.x + container.width + tolerance &&
    child.y + child.height <= container.y + container.height + tolerance
  );
}

/**
 * Checks if a rectangle is completely contained within the viewport boundaries (0, 0, viewport.width, viewport.height).
 * Allows a small tolerance (default 0.5px) for subpixel rounding.
 */
export function isContainedInViewport(rect: Rect, viewport: { width: number; height: number }, tolerance = 0.5): boolean {
  return isContainedIn(rect, { x: 0, y: 0, width: viewport.width, height: viewport.height }, tolerance);
}

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
