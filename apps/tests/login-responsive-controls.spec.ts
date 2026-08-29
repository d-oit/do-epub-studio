import { test, expect } from '@playwright/test';
import {
  VIEWPORT_MATRIX,
  rectanglesIntersect,
  isContainedInViewport,
  isHorizontallyContainedInViewport,
  isContained,
} from './viewport-matrix';
import {
  TEST_USER,
  DEMO_READER,
  DEMO_READER_RESPONSE,
  mockReaderApi,
  suppressWorkboxErrors,
} from './fixtures';
import { I18N_E2E_STRINGS } from './i18n-e2e-helpers';

test.describe('Responsive Login Controls & Layout Matrix', () => {
  test.beforeEach(async ({ page }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { includeBookmarks: false });
  });

  for (const viewport of VIEWPORT_MATRIX) {
    test.describe(`Viewport: ${viewport.label} (${viewport.width}x${viewport.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      });

      test('Password visibility toggle geometry & behavior', async ({ page }) => {
        const errorCtx = `Viewport ${viewport.label} (${viewport.width}x${viewport.height})`;
        await page.goto(`/login?book=${TEST_USER.bookSlug}`);

        const passwordInput = page.getByRole('textbox', { name: /Password/i });
        await expect(passwordInput, `${errorCtx}: password input visible`).toBeVisible();
        await expect(passwordInput, `${errorCtx}: initial type is password`).toHaveAttribute('type', 'password');

        const toggle = page.locator('button[aria-controls="password"]');
        await expect(toggle, `${errorCtx}: password toggle button visible`).toBeVisible();

        const toggleName = await toggle.getAttribute('aria-label');
        expect(toggleName, `${errorCtx}: toggle has stable accessible label`).toBeTruthy();

        await passwordInput.scrollIntoViewIfNeeded();
        const passwordBox = await passwordInput.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(passwordBox, `${errorCtx}: password field has bounding box`).not.toBeNull();
        expect(toggleBox, `${errorCtx}: toggle has bounding box`).not.toBeNull();

        // Toggle button must be contained inside password input field bounds
        expect(
          isContained(toggleBox!, passwordBox!, 2),
          `${errorCtx}: toggle box (${JSON.stringify(toggleBox)}) must be contained within password input box (${JSON.stringify(passwordBox)})`,
        ).toBe(true);

        // Toggle box must fit horizontally in viewport without clipping
        expect(
          isHorizontallyContainedInViewport(toggleBox!, viewport),
          `${errorCtx}: toggle box must fit horizontally in viewport`,
        ).toBe(true);

        // Position check in LTR: toggle is on trailing half of field
        expect(
          toggleBox!.x + toggleBox!.width / 2,
          `${errorCtx}: LTR toggle is on trailing half of password input`,
        ).toBeGreaterThan(passwordBox!.x + passwordBox!.width / 2);

        // Interaction behavior: password -> text -> password
        await toggle.click();
        await expect(passwordInput, `${errorCtx}: input type changed to text`).toHaveAttribute('type', 'text');

        await toggle.click();
        await expect(passwordInput, `${errorCtx}: input type restored to password`).toHaveAttribute('type', 'password');
      });

      test('Header controls layout, collision, & keyboard navigation', async ({ page }) => {
        const errorCtx = `Viewport ${viewport.label} (${viewport.width}x${viewport.height})`;
        await page.goto(`/login?book=${TEST_USER.bookSlug}`);

        const headerContainer = page.locator('[data-testid="login-header-controls"]');
        await expect(headerContainer, `${errorCtx}: header container visible`).toBeVisible();

        const themeToggle = headerContainer.locator('button').first();
        const localeSelector = page.getByRole('combobox');

        await expect(themeToggle, `${errorCtx}: theme toggle visible`).toBeVisible();
        await expect(localeSelector, `${errorCtx}: locale selector visible`).toBeVisible();

        const themeBox = await themeToggle.boundingBox();
        const localeBox = await localeSelector.boundingBox();

        expect(themeBox, `${errorCtx}: theme toggle bounding box`).not.toBeNull();
        expect(localeBox, `${errorCtx}: locale selector bounding box`).not.toBeNull();

        // Header controls must not intersect each other
        expect(
          rectanglesIntersect(themeBox!, localeBox!),
          `${errorCtx}: theme toggle (${JSON.stringify(themeBox)}) and locale selector (${JSON.stringify(localeBox)}) must not intersect`,
        ).toBe(false);

        // Header controls must be contained within viewport without edge clipping
        expect(
          isContainedInViewport(themeBox!, viewport),
          `${errorCtx}: theme toggle must be inside viewport bounds`,
        ).toBe(true);

        expect(
          isContainedInViewport(localeBox!, viewport),
          `${errorCtx}: locale selector must be inside viewport bounds`,
        ).toBe(true);

        // No horizontal overflow
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `${errorCtx}: document must not have horizontal overflow`).toBe(false);

        // Keyboard navigation predictability
        await themeToggle.focus();
        await expect(themeToggle, `${errorCtx}: theme toggle focused`).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(localeSelector, `${errorCtx}: locale selector focused after Tab`).toBeFocused();
      });

      test('Login card containment, header relationship, & no-book-context guard', async ({ page }) => {
        const errorCtx = `Viewport ${viewport.label} (${viewport.width}x${viewport.height})`;

        await page.goto('/login');

        const noBookNotice = page.locator('p[role="status"]');
        await expect(noBookNotice, `${errorCtx}: no-book-context guard notice visible`).toBeVisible();

        const loginCard = page.locator('[data-testid="login-card"]');
        await expect(loginCard, `${errorCtx}: login card visible`).toBeVisible();

        const cardBox = await loginCard.boundingBox();
        const passwordInput = page.getByRole('textbox', { name: /Password/i });
        const submitBtn = page.getByRole('button', { name: I18N_E2E_STRINGS.en.loginSubmit, exact: true });

        await expect(passwordInput, `${errorCtx}: password field visible`).toBeVisible();
        await expect(submitBtn, `${errorCtx}: sign-in button visible`).toBeVisible();

        await passwordInput.scrollIntoViewIfNeeded();
        const passwordBox = await passwordInput.boundingBox();

        await submitBtn.scrollIntoViewIfNeeded();
        const submitBox = await submitBtn.boundingBox();

        expect(cardBox, `${errorCtx}: login card bounding box`).not.toBeNull();
        expect(passwordBox, `${errorCtx}: password input bounding box`).not.toBeNull();
        expect(submitBox, `${errorCtx}: submit button bounding box`).not.toBeNull();

        // Horizontal viewport containment
        expect(
          isHorizontallyContainedInViewport(cardBox!, viewport),
          `${errorCtx}: login card (${JSON.stringify(cardBox)}) must fit horizontally in viewport width (${viewport.width})`,
        ).toBe(true);

        expect(
          isHorizontallyContainedInViewport(passwordBox!, viewport),
          `${errorCtx}: password field must fit horizontally in viewport`,
        ).toBe(true);

        expect(
          isHorizontallyContainedInViewport(submitBox!, viewport),
          `${errorCtx}: submit button must fit horizontally in viewport`,
        ).toBe(true);

        // Header controls do not intersect password field or submit button
        const headerContainer = page.locator('[data-testid="login-header-controls"]');
        const headerBox = await headerContainer.boundingBox();
        if (headerBox) {
          expect(
            rectanglesIntersect(headerBox, passwordBox!),
            `${errorCtx}: header controls must not intersect password input`,
          ).toBe(false);
          expect(
            rectanglesIntersect(headerBox, submitBox!),
            `${errorCtx}: header controls must not intersect submit button`,
          ).toBe(false);
        }
      });

      test('Long-label locale (French) rendering & geometry', async ({ page }) => {
        const errorCtx = `Viewport ${viewport.label} (${viewport.width}x${viewport.height}) [fr]`;
        await page.goto(`/login?book=${TEST_USER.bookSlug}`);

        const localeSelector = page.getByRole('combobox');
        await localeSelector.selectOption('fr');

        const submitBtn = page.getByRole('button', { name: I18N_E2E_STRINGS.fr.loginSubmit, exact: true });
        await expect(submitBtn, `${errorCtx}: French submit button visible`).toBeVisible();

        const passwordInput = page.getByRole('textbox', { name: /Mot de passe/i });
        await expect(passwordInput, `${errorCtx}: French password label visible`).toBeVisible();

        const toggle = page.locator('button[aria-controls="password"]');
        await expect(toggle, `${errorCtx}: password toggle visible in French`).toBeVisible();

        const toggleLabel = await toggle.getAttribute('aria-label');
        expect(toggleLabel, `${errorCtx}: French toggle aria-label`).toContain('mot de passe');

        await passwordInput.scrollIntoViewIfNeeded();
        const passwordBox = await passwordInput.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(
          isContained(toggleBox!, passwordBox!, 2),
          `${errorCtx}: toggle contained in password input under long locale`,
        ).toBe(true);

        expect(
          isHorizontallyContainedInViewport(toggleBox!, viewport),
          `${errorCtx}: toggle fits horizontally in viewport under long locale`,
        ).toBe(true);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `${errorCtx}: no horizontal overflow under French locale`).toBe(false);
      });

      test('Theme toggle (Dark Mode) geometry & layout stability', async ({ page }) => {
        const errorCtx = `Viewport ${viewport.label} (${viewport.width}x${viewport.height}) [dark]`;
        await page.goto(`/login?book=${TEST_USER.bookSlug}`);

        const themeToggle = page.locator('[data-testid="login-header-controls"] button').first();
        await themeToggle.click();

        const passwordInput = page.getByRole('textbox', { name: /Password/i });
        const toggle = page.locator('button[aria-controls="password"]');

        await passwordInput.scrollIntoViewIfNeeded();
        const passwordBox = await passwordInput.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(
          isContained(toggleBox!, passwordBox!, 2),
          `${errorCtx}: toggle contained in password field in dark mode`,
        ).toBe(true);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `${errorCtx}: no horizontal overflow in dark mode`).toBe(false);
      });

      test('RTL direction (Arabic) geometry & trailing/leading toggle placement', async ({ page }) => {
        const errorCtx = `Viewport ${viewport.label} (${viewport.width}x${viewport.height}) [RTL]`;
        await page.goto(`/login?book=${TEST_USER.bookSlug}`);

        const localeSelector = page.getByRole('combobox');
        await localeSelector.selectOption('ar');

        await page.evaluate(() => {
          document.documentElement.dir = 'rtl';
        });

        const passwordInput = page.getByRole('textbox', { name: /كلمة المرور|Password/i });
        await expect(passwordInput, `${errorCtx}: password input visible in RTL`).toBeVisible();

        const toggle = page.locator('button[aria-controls="password"]');
        await expect(toggle, `${errorCtx}: toggle visible in RTL`).toBeVisible();

        await passwordInput.scrollIntoViewIfNeeded();
        const passwordBox = await passwordInput.boundingBox();
        const toggleBox = await toggle.boundingBox();

        expect(passwordBox, `${errorCtx}: RTL password box`).not.toBeNull();
        expect(toggleBox, `${errorCtx}: RTL toggle box`).not.toBeNull();

        expect(
          isContained(toggleBox!, passwordBox!, 2),
          `${errorCtx}: toggle contained in password input in RTL`,
        ).toBe(true);

        // Position check in RTL: toggle is on leading (left) half of password input
        expect(
          toggleBox!.x + toggleBox!.width / 2,
          `${errorCtx}: RTL toggle is on leading half of password input`,
        ).toBeLessThan(passwordBox!.x + passwordBox!.width / 2);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `${errorCtx}: no horizontal overflow in RTL mode`).toBe(false);
      });
    });
  }

  test('Existing login submission behavior is preserved', async ({ page }) => {
    await page.goto(`/login?book=${TEST_USER.bookSlug}`);

    await page.getByRole('textbox', { name: /Email/i }).fill(TEST_USER.email);
    await page.getByRole('textbox', { name: /Password/i }).fill(TEST_USER.password);
    await page.getByRole('button', { name: I18N_E2E_STRINGS.en.loginSubmit, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/read/${TEST_USER.bookSlug}$`), { timeout: 15000 });
  });

  test('Demo reader account login via credential autofill preserves submission flow', async ({ page }) => {
    await mockReaderApi(page, { bookSlug: DEMO_READER.bookSlug, loginResponse: DEMO_READER_RESPONSE });
    await page.goto(`/login?book=${DEMO_READER.bookSlug}`);

    const fillDemoBtn = page.getByRole('button', { name: /Fill demo credentials/i });
    if (await fillDemoBtn.isVisible().catch(() => false)) {
      await fillDemoBtn.click();
      await expect(page.getByLabel(/Email/i)).toHaveValue(DEMO_READER.email);
      await expect(page.getByRole('textbox', { name: /Password/i })).toHaveValue(DEMO_READER.password);
    } else {
      await page.getByLabel(/Email/i).fill(DEMO_READER.email);
      await page.getByRole('textbox', { name: /Password/i }).fill(DEMO_READER.password);
    }

    await page.getByRole('button', { name: I18N_E2E_STRINGS.en.loginSubmit, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/read/${DEMO_READER.bookSlug}$`), { timeout: 15000 });
  });

  test('Login page vertical geometry: desktop fits viewport, mobile has no horizontal overflow', async ({ page }) => {
    // Desktop (1440x900): the login page must fit the viewport height.
    // Regression guard for PR #1045 (in-flow header + lg:min-h-dvh on main
    // would otherwise force a permanent vertical scrollbar at >=lg).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/login?book=${TEST_USER.bookSlug}`);
    await expect(page.getByRole('button', { name: I18N_E2E_STRINGS.en.loginSubmit, exact: true })).toBeVisible();
    const desktop = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    expect(
      desktop.scrollHeight,
      `desktop 1440x900: login page fits viewport (scrollHeight ${desktop.scrollHeight} vs innerHeight ${desktop.innerHeight})`,
    ).toBeLessThanOrEqual(desktop.innerHeight + 1);

    // Mobile (320px): vertical stacking is allowed; horizontal overflow is not.
    await page.setViewportSize({ width: 320, height: 568 });
    await page.reload();
    await expect(page.getByRole('button', { name: I18N_E2E_STRINGS.en.loginSubmit, exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, 'mobile 320px: no horizontal overflow on /login').toBe(false);
  });
});
