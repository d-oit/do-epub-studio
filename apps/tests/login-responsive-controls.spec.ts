import { test, expect } from '@playwright/test';
import { VIEWPORT_MATRIX, rectanglesIntersect, isContainedIn, isContainedInViewport } from './viewport-matrix';
import { mockReaderApi, TEST_USER } from './fixtures';

/**
 * Responsive E2E tests for the login page covering password toggle, locale switcher,
 * theme toggle, card layout, overflow, control collisions, and keyboard reachability.
 */

// Supported test matrix permutations
const LOCALES = [
  { code: 'en', name: 'English (Default)', dir: 'ltr', longLabel: false },
  { code: 'fr', name: 'French (Long label)', dir: 'ltr', longLabel: true },
  { code: 'ar', name: 'Arabic (RTL)', dir: 'rtl', longLabel: false },
] as const;

const THEMES = ['light', 'dark'] as const;

test.describe('Login page responsive controls and geometry', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API requests for reader
    await mockReaderApi(page, { includeBookmarks: false });
  });

  for (const viewport of VIEWPORT_MATRIX) {
    test.describe(`Viewport: ${viewport.label} (${viewport.width}x${viewport.height})`, () => {

      for (const localeObj of LOCALES) {
        for (const theme of THEMES) {

          test(`locale=${localeObj.code} theme=${theme} layout & controls geometry`, async ({ page }) => {
            const viewportContext = `${viewport.label} (${viewport.width}x${viewport.height}), locale=${localeObj.code}, theme=${theme}`;

            // Set viewport size
            await page.setViewportSize({ width: viewport.width, height: viewport.height });

            // Navigate to login page
            await page.goto(`/login?book=${TEST_USER.bookSlug}`);

            // 1. Select locale if not default
            const localeSwitcher = page.getByTestId('locale-switcher');
            await expect(localeSwitcher, `${viewportContext}: locale switcher should be visible`).toBeVisible();
            await localeSwitcher.selectOption(localeObj.code);

            // Verify document direction matches active locale
            const documentDir = await page.evaluate(() => document.documentElement.dir || 'ltr');
            expect(documentDir, `${viewportContext}: document dir should match locale`).toBe(localeObj.dir);

            // 2. Select theme
            const themeToggleBtn = page.getByTestId('theme-toggle');
            await expect(themeToggleBtn, `${viewportContext}: theme toggle should be visible`).toBeVisible();

            const isDarkInitially = await page.evaluate(() => document.documentElement.classList.contains('dark'));
            if ((theme === 'dark' && !isDarkInitially) || (theme === 'light' && isDarkInitially)) {
              await themeToggleBtn.click();
            }

            const isDarkNow = await page.evaluate(() => document.documentElement.classList.contains('dark'));
            expect(isDarkNow, `${viewportContext}: theme dark class match`).toBe(theme === 'dark');

            // 3. No horizontal overflow assertion
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            expect(overflow, `${viewportContext}: document should not have horizontal overflow`).toBe(false);

            // 4. Header controls geometry checks
            const themeBox = await themeToggleBtn.boundingBox();
            const localeBox = await localeSwitcher.boundingBox();

            expect(themeBox, `${viewportContext}: theme toggle boundingBox`).not.toBeNull();
            expect(localeBox, `${viewportContext}: locale switcher boundingBox`).not.toBeNull();

            if (themeBox && localeBox) {
              // Non-intersection check between theme toggle and locale switcher
              const headerControlsIntersect = rectanglesIntersect(themeBox, localeBox);
              expect(headerControlsIntersect, `${viewportContext}: header controls must not intersect`).toBe(false);

              // Horizontal bounds check: neither control intersects viewport left/right edges
              expect(themeBox.x >= -0.5 && themeBox.x + themeBox.width <= viewport.width + 0.5, `${viewportContext}: theme toggle within horizontal viewport bounds`).toBe(true);
              expect(localeBox.x >= -0.5 && localeBox.x + localeBox.width <= viewport.width + 0.5, `${viewportContext}: locale switcher within horizontal viewport bounds`).toBe(true);

              // Viewport containment check for fixed header controls
              const themeInViewport = isContainedInViewport(themeBox, viewport);
              const localeInViewport = isContainedInViewport(localeBox, viewport);
              expect(themeInViewport, `${viewportContext}: theme toggle must be fully contained in viewport`).toBe(true);
              expect(localeInViewport, `${viewportContext}: locale switcher must be fully contained in viewport`).toBe(true);
            }

            // 5. Password field visibility control checks
            const passwordInput = page.getByRole('textbox', { name: /Password|Mot de passe|كلمة المرور/i });
            await passwordInput.scrollIntoViewIfNeeded();
            await expect(passwordInput, `${viewportContext}: password field visible`).toBeVisible();
            await expect(passwordInput).toHaveAttribute('type', 'password');

            // Password visibility control locator (uses aria-controls="password")
            const toggleShow = page.locator('button[aria-controls="password"]');
            await expect(toggleShow, `${viewportContext}: password visibility control visible`).toBeVisible();

            // Check stable accessible name on visibility control
            const toggleAccessibleName = await toggleShow.getAttribute('aria-label');
            expect(toggleAccessibleName, `${viewportContext}: password visibility control accessible name`).toBeTruthy();

            const inputBox = await passwordInput.boundingBox();
            const toggleBox = await toggleShow.boundingBox();

            expect(inputBox, `${viewportContext}: password input boundingBox`).not.toBeNull();
            expect(toggleBox, `${viewportContext}: password toggle button boundingBox`).not.toBeNull();

            if (inputBox && toggleBox) {
              // The control remains within the password field bounds
              const toggleInInput = isContainedIn(toggleBox, inputBox);
              expect(toggleInInput, `${viewportContext}: password toggle must remain within password input field bounds`).toBe(true);

              // The control is not clipped by viewport boundaries
              expect(toggleBox.x >= 0 && toggleBox.x + toggleBox.width <= viewport.width, `${viewportContext}: password toggle not clipped horizontally`).toBe(true);
            }

            // Test typing password
            await passwordInput.fill('Secret123!');

            // Click control to reveal password
            await toggleShow.click();
            await expect(passwordInput).toHaveAttribute('type', 'text');

            // Click control again to restore password mask
            await toggleShow.click();
            await expect(passwordInput).toHaveAttribute('type', 'password');

            // 6. Login card and layout bounds checks
            const loginCard = page.getByTestId('login-card');
            await expect(loginCard, `${viewportContext}: login card visible`).toBeVisible();

            const cardBox = await loginCard.boundingBox();
            expect(cardBox, `${viewportContext}: login card boundingBox`).not.toBeNull();

            if (cardBox) {
              // Login card remains within viewport horizontally
              expect(cardBox.x >= -0.5, `${viewportContext}: card left edge within viewport`).toBe(true);
              expect(cardBox.x + cardBox.width <= viewport.width + 0.5, `${viewportContext}: card right edge within viewport`).toBe(true);
            }

            // Sign-in button reachable without horizontal scroll
            const signInBtn = page.getByRole('button', { name: /Sign In|Connexion|تسجيل الدخول/i, exact: true });
            await signInBtn.scrollIntoViewIfNeeded();
            await expect(signInBtn, `${viewportContext}: sign-in button visible`).toBeVisible();

            const signInBox = await signInBtn.boundingBox();
            expect(signInBox, `${viewportContext}: sign-in button boundingBox`).not.toBeNull();
            if (signInBox) {
              expect(signInBox.x >= 0 && signInBox.x + signInBox.width <= viewport.width, `${viewportContext}: sign-in button within viewport horizontal bounds`).toBe(true);
            }
          });

        }
      }

    });
  }

  test('no-book-context status guard and login copy remain intact when no book param is provided', async ({ page }) => {
    await page.goto('/login');

    // Verify warning status message is present when no book context is provided
    const statusGuard = page.getByRole('status');
    await expect(statusGuard).toBeVisible();
    await expect(statusGuard).toContainText('This link does not include a book');

    // Sign in button is disabled when no book context exists
    const signInBtn = page.getByRole('button', { name: 'Sign In', exact: true });
    await expect(signInBtn).toBeDisabled();
  });

  test('keyboard reachability in a predictable order', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`/login?book=${TEST_USER.bookSlug}`);

    // Focus the first interactive element in header (ThemeToggle)
    const themeToggle = page.getByTestId('theme-toggle');
    await themeToggle.focus();
    await expect(themeToggle).toBeFocused();

    // Tab to LocaleSwitcher
    await page.keyboard.press('Tab');
    const localeSwitcher = page.getByTestId('locale-switcher');
    await expect(localeSwitcher).toBeFocused();

    // Tab through page elements until reaching email input
    let emailFocused = false;
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const activeId = await page.evaluate(() => document.activeElement?.id);
      if (activeId === 'email') {
        emailFocused = true;
        break;
      }
    }
    expect(emailFocused, 'Tab navigation should reach email input').toBe(true);

    // Tab to password input
    await page.keyboard.press('Tab');
    await expect(page.locator('#password')).toBeFocused();

    // Tab to password toggle button
    await page.keyboard.press('Tab');
    await expect(page.locator('button[aria-controls="password"]')).toBeFocused();
  });
});
