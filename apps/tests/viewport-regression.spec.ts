import { test, expect, type Page } from '@playwright/test';
import { assertViewportMatrix } from './viewport-matrix';
import {
  loginAsAdmin,
  mockAdminApi,
  loginAsReader,
  mockReaderApi,
  suppressWorkboxErrors,
  clickToolbarButton,
} from './fixtures';

const E2_VIEWPORTS = [
  { label: 'mobile-sm', width: 320, height: 568 },
  { label: 'landscape-mobile', width: 812, height: 375 },
  { label: 'desktop', width: 1440, height: 900 },
] as const;

const LOCALE_STEPS = [
  {
    locale: 'en',
    dir: 'ltr',
    loginButton: 'Sign In',
    adminText: 'Your Books',
    readerAction: 'Contents',
  },
  {
    locale: 'ar',
    dir: 'rtl',
    loginButton: 'تسجيل الدخول',
    adminText: 'كتبك',
    readerAction: 'المحتويات',
  },
  {
    locale: 'de',
    dir: 'ltr',
    loginButton: 'Anmelden',
    adminText: 'Deine Bücher',
    readerAction: 'Inhalt',
  },
] as const;

async function switchLocaleViaSwitcher(page: Page, locale: string) {
  const switcher = page
    .getByRole('combobox', { name: /Select (locale|language)|اختيار اللغة|Sprache auswählen/i })
    .first();
  await expect(switcher).toBeVisible({ timeout: 10000 });
  await switcher.selectOption(locale);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', locale, { timeout: 10000 });
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr', {
    timeout: 10000,
  });
}

async function setAndPersistLocale(page: Page, locale: string) {
  await page.evaluate((loc) => {
    localStorage.setItem('do-epub-locale', JSON.stringify({ state: { locale: loc }, version: 0 }));
  }, locale);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('lang', locale, { timeout: 10000 });
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr', {
    timeout: 10000,
  });
}

async function assertKeyboardFocusAndNoOverflow(
  page: Page,
  step: { locale: string },
  viewport: { label: string; width: number },
) {
  await page.keyboard.press('Tab');
  const focused1 = page.locator(':focus');
  await expect(focused1).toBeVisible();
  await expect(focused1).toBeEnabled();
  const box1 = await focused1.boundingBox();
  expect(box1, `${step.locale} ${viewport.label}: focused element has geometry`).not.toBeNull();
  expect(
    box1!.x,
    `${step.locale} ${viewport.label}: focused stays within left boundary`,
  ).toBeGreaterThanOrEqual(-1);
  expect(
    box1!.x + box1!.width,
    `${step.locale} ${viewport.label}: focused stays within viewport width`,
  ).toBeLessThanOrEqual(viewport.width + 1);
  // Capture handle to the first focused element
  const firstElementHandle = await focused1.elementHandle();
  expect(firstElementHandle).not.toBeNull();

  // Tab again and assert focus moved away from the first element
  await page.keyboard.press('Tab');
  const isStillFocused = await page.evaluate(
    (el) => document.activeElement === el,
    firstElementHandle,
  );
  expect(
    isStillFocused,
    `${step.locale} ${viewport.label}: focus moved away from first element`,
  ).toBe(false);

  const focused2 = page.locator(':focus');
  await expect(focused2).toBeVisible();
  await expect(focused2).toBeEnabled();
  const box2 = await focused2.boundingBox();
  expect(
    box2,
    `${step.locale} ${viewport.label}: next focused element has geometry`,
  ).not.toBeNull();
  expect(
    box2!.x,
    `${step.locale} ${viewport.label}: next focused stays within left boundary`,
  ).toBeGreaterThanOrEqual(-1);
  expect(
    box2!.x + box2!.width,
    `${step.locale} ${viewport.label}: next focused stays within viewport width`,
  ).toBeLessThanOrEqual(viewport.width + 1);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow, `${step.locale} ${viewport.label}: no horizontal overflow`).toBe(false);
}
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

        expect(
          passwordBox,
          `${viewport.label}: password field should have geometry`,
        ).not.toBeNull();
        expect(toggleBox, `${viewport.label}: password toggle should have geometry`).not.toBeNull();
        expect(
          toggleBox!.x,
          `${viewport.label}: toggle stays inside the field`,
        ).toBeGreaterThanOrEqual(passwordBox!.x);
        expect(
          toggleBox!.x + toggleBox!.width / 2,
          `${viewport.label}: toggle stays on the trailing half`,
        ).toBeGreaterThan(passwordBox!.x + passwordBox!.width / 2);
        expect(
          toggleBox!.x + toggleBox!.width,
          `${viewport.label}: toggle does not overflow the field`,
        ).toBeLessThanOrEqual(passwordBox!.x + passwordBox!.width + 1);
        expect(
          toggleBox!.y + toggleBox!.height / 2,
          `${viewport.label}: toggle is vertically centered`,
        ).toBeGreaterThan(passwordBox!.y);
        expect(
          toggleBox!.y + toggleBox!.height / 2,
          `${viewport.label}: toggle is vertically centered`,
        ).toBeLessThan(passwordBox!.y + passwordBox!.height);

        await toggle.click();
        await expect(passwordInput, `${viewport.label}: toggle reveals password`).toHaveAttribute(
          'type',
          'text',
        );
        await toggle.click();
        await expect(passwordInput, `${viewport.label}: toggle hides password`).toHaveAttribute(
          'type',
          'password',
        );
      },
    });
  });

  test('@mobile catalog page has no overflow across all viewports', async ({ page }) => {
    await assertViewportMatrix(page, '/', {
      assertAtEachViewport: async (page, viewport) => {
        // Verify focus indicators are visible and contained within the viewport
        const firstInteractive = page
          .locator('a, button, input:not([type="hidden"]), select, textarea, [tabindex="0"]')
          .first();
        await expect(
          firstInteractive,
          `${viewport.label}: interactive element should be visible`,
        ).toBeVisible({ timeout: 5000 });
        await firstInteractive.focus();
        await expect(
          firstInteractive,
          `${viewport.label}: interactive element should be focused`,
        ).toBeFocused();

        // Focus ring / interactive box must be within viewport boundaries (not clipped or overflowing)
        const box = await firstInteractive.boundingBox();
        expect(
          box,
          `${viewport.label}: interactive element should have bounding box`,
        ).not.toBeNull();
        expect(
          box!.x,
          `${viewport.label}: interactive element stays within left boundary`,
        ).toBeGreaterThanOrEqual(-1);
        expect(
          box!.x + box!.width,
          `${viewport.label}: interactive element does not horizontally overflow viewport`,
        ).toBeLessThanOrEqual(viewport.width + 1);
      },
    });
  });

  test('@mobile real-locale switching on login route (en -> ar -> de) has no overflow', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    for (const step of LOCALE_STEPS) {
      await switchLocaleViaSwitcher(page, step.locale);
      await expect(page.locator('html')).toHaveAttribute('lang', step.locale);
      await expect(page.locator('html')).toHaveAttribute('dir', step.dir);
      await expect(page.getByRole('button', { name: step.loginButton })).toBeVisible();

      for (const viewport of E2_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await assertKeyboardFocusAndNoOverflow(page, step, viewport);
      }
    }
  });

  test('@mobile real-locale switching on admin route (en -> ar -> de) has no overflow', async ({
    page,
  }) => {
    await mockAdminApi(page);
    await loginAsAdmin(page);
    await page.goto('/admin/books', { waitUntil: 'domcontentloaded' });

    for (const step of LOCALE_STEPS) {
      await switchLocaleViaSwitcher(page, step.locale);
      await expect(page.locator('html')).toHaveAttribute('lang', step.locale);
      await expect(page.locator('html')).toHaveAttribute('dir', step.dir);
      await expect(page.getByText(step.adminText).first()).toBeVisible();

      for (const viewport of E2_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await assertKeyboardFocusAndNoOverflow(page, step, viewport);
      }
    }
  });

  test('@mobile real-locale switching on reader route (en -> ar -> de) has no overflow', async ({
    page,
  }) => {
    suppressWorkboxErrors(page);
    await mockReaderApi(page, { epubUrl: 'https://example.com/test.epub' });
    await loginAsReader(page);
    await page.goto('/read/book-1', { waitUntil: 'domcontentloaded' });

    for (const step of LOCALE_STEPS) {
      await setAndPersistLocale(page, step.locale);
      await expect(page.locator('html')).toHaveAttribute('lang', step.locale);
      await expect(page.locator('html')).toHaveAttribute('dir', step.dir);

      // Open TOC panel using translated toolbar action
      await clickToolbarButton(page, step.readerAction);
      const tocPanel = page.locator('[data-container-name="toc-panel"]');
      await expect(tocPanel).toBeVisible({ timeout: 15000 });

      // Close TOC panel via Escape and assert it closes
      await page.keyboard.press('Escape');
      await expect(tocPanel).not.toBeVisible();

      for (const viewport of E2_VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await assertKeyboardFocusAndNoOverflow(page, step, viewport);
      }
    }
  });
});
