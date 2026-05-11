/**
 * Playwright helpers for stable visual regression testing and reliable locators.
 * Derived from LEARNINGS.md best practices.
 */

import type { Page } from '@playwright/test';

/**
 * Masks animated elements for stable visual regression screenshots.
 * Targets: SVG animations, skeletons, canvas, progress bars.
 * 
 * @param page - Playwright Page instance
 * 
 * @example
 * await maskAnimated(page);
 * await page.screenshot({ path: 'screenshot.png' });
 */
export async function maskAnimated(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      svg[animate],
      svg [animate],
      .skeleton,
      [class*="skeleton"],
      canvas,
      [role="progressbar"],
      [aria-busy="true"] {
        visibility: hidden !important;
      }
    `,
  });
}

/**
 * Waits for network idle and a configurable settle time for Framer Motion springs.
 * 
 * @param page - Playwright Page instance
 * @param ms - Additional milliseconds to wait after network idle (default: 500ms)
 * 
 * @example
 * await waitForAnimations(page, 1000); // Wait for network + 1 second settle
 */
export async function waitForAnimations(page: Page, ms: number = 500): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(ms);
}

/**
 * Creates a strict locator with exact text matching to prevent strict-mode violations.
 * Uses { exact: true } for dynamic UIs where partial matches cause flakiness.
 * 
 * @param page - Playwright Page instance
 * @param selector - CSS selector or role
 * @param text - Exact text to match
 * 
 * @example
 * const button = strictLocator(page, 'button', 'Submit');
 * await button.click();
 * 
 * @example
 * const heading = strictLocator(page, 'h1', 'Welcome');
 * await expect(heading).toBeVisible();
 */
export function strictLocator(page: Page, selector: string, text: string) {
return page.locator(selector, { hasText: text, exact: true });
}
