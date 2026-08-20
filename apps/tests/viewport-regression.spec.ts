import { test, expect } from '@playwright/test';
import { assertViewportMatrix, VIEWPORT_MATRIX } from './viewport-matrix';

test.describe('Viewport regression matrix', () => {
  test('@mobile login page has no overflow across all viewports', async ({ page }) => {
    await assertViewportMatrix(page, '/login', {
      required: [
        'input[type="email"], input[name="email"], label:has-text("Email")',
        'input[type="password"], input[name="password"], label:has-text("Password")',
        'button:has-text("Sign In"), button[type="submit"]',
      ],
      assertAtEachViewport: async (page, viewport) => {
        const passwordInput = page.getByRole('textbox', { name: 'Password' });
        const toggle = page.locator('button[aria-controls="password"]');
        const passwordBox = await passwordInput.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(passwordBox, `${viewport.label}: password field should have geometry`).not.toBeNull();
        expect(toggleBox, `${viewport.label}: password toggle should have geometry`).not.toBeNull();
        expect(toggleBox!.x, `${viewport.label}: toggle stays inside the field`).toBeGreaterThanOrEqual(passwordBox!.x);
        expect(toggleBox!.x, `${viewport.label}: toggle stays on the leading half`).toBeLessThan(passwordBox!.x + passwordBox!.width / 2);
        expect(toggleBox!.x + toggleBox!.width, `${viewport.label}: toggle does not overflow the field`).toBeLessThanOrEqual(passwordBox!.x + passwordBox!.width);
        expect(toggleBox!.y + toggleBox!.height / 2, `${viewport.label}: toggle is vertically centered`).toBeGreaterThan(passwordBox!.y);
        expect(toggleBox!.y + toggleBox!.height / 2, `${viewport.label}: toggle is vertically centered`).toBeLessThan(passwordBox!.y + passwordBox!.height);

        await toggle.click();
        await expect(passwordInput, `${viewport.label}: toggle reveals password`).toHaveAttribute('type', 'text');
        await toggle.click();
        await expect(passwordInput, `${viewport.label}: toggle hides password`).toHaveAttribute('type', 'password');
      },
    });
  });

  test('@mobile catalog page has no overflow across all viewports', async ({ page }) => {
    await assertViewportMatrix(page, '/', {
      assertAtEachViewport: async (page, viewport) => {
        // Verify focus indicators are visible
        const firstInteractive = page.locator('a, button, [tabindex="0"]').first();
        if (await firstInteractive.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstInteractive.focus();
          // Focus ring should be visible (not clipped)
          const box = await firstInteractive.boundingBox();
          if (box) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
          }
        }
      },
    });
  });

  test('@mobile RTL layout has no overflow', async ({ page }) => {
    for (const viewport of VIEWPORT_MATRIX) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login', { waitUntil: 'domcontentloaded' });

      // Set RTL direction
      await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
        document.documentElement.lang = 'ar';
      });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `RTL ${viewport.label}: no horizontal overflow`).toBe(false);

      // Reset
      await page.evaluate(() => {
        document.documentElement.dir = '';
        document.documentElement.lang = '';
      });
    }
  });
});
