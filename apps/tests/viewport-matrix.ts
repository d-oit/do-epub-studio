import { type Page, expect } from '@playwright/test';

/**
 * Standard viewport sizes for regression testing.
 * Includes 'tablet-sm' (640x960) to cover the Tailwind 'sm' breakpoint boundary
 * where header controls and labels wrap between mobile and tablet viewports.
 */
export const VIEWPORT_MATRIX = [
  { label: 'mobile-sm', width: 320, height: 568 },
  { label: 'mobile-md', width: 375, height: 812 },
  { label: 'mobile-lg', width: 390, height: 844 },
  { label: 'tablet-sm', width: 640, height: 960 },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'laptop', width: 1024, height: 768 },
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'large-desktop', width: 1920, height: 1080 },
  { label: 'landscape-mobile', width: 812, height: 375 },
] as const;

export type Viewport = (typeof VIEWPORT_MATRIX)[number];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks if two bounding boxes intersect.
 */
export function rectanglesIntersect(first: BoundingBox, second: BoundingBox): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

/**
 * Checks if a bounding box is fully contained within the viewport boundaries.
 */
export function isContainedInViewport(
  box: BoundingBox,
  viewport: { width: number; height: number },
  margin = 0,
): boolean {
  return (
    box.x >= -margin &&
    box.y >= -margin &&
    box.x + box.width <= viewport.width + margin + 1 &&
    box.y + box.height <= viewport.height + margin + 1
  );
}

/**
 * Checks if a bounding box fits horizontally within viewport width.
 */
export function isHorizontallyContainedInViewport(
  box: BoundingBox,
  viewport: { width: number; height: number },
  tolerance = 1,
): boolean {
  return box.x >= -tolerance && box.x + box.width <= viewport.width + tolerance;
}

/**
 * Checks if a child bounding box is fully contained within a parent bounding box.
 */
export function isContained(child: BoundingBox, parent: BoundingBox, tolerance = 1): boolean {
  return (
    child.x >= parent.x - tolerance &&
    child.y >= parent.y - tolerance &&
    child.x + child.width <= parent.x + parent.width + tolerance &&
    child.y + child.height <= parent.y + parent.height + tolerance
  );
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
