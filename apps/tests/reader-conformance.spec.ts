import type { Page } from '@playwright/test';
import {
  LOGIN_RESPONSE,
  mockReaderApi,
  loginAsReader,
  suppressWorkboxErrors,
} from './fixtures';
import { buildMultilingualEpub, type MultilingualFixtureId } from '@do-epub-studio/testkit';

/**
 * Reader typography / navigation conformance across browsers (issue #1491).
 * Registered in the existing Playwright matrix via the root
 * `playwright.config.ts` testMatch — runs in Chromium, WebKit (when
 * `PLAYWRIGHT_INCLUDE_WEBKIT=1`) and mobile projects. Rendered assertions only;
 * parsing-level behavior is covered by
 * `packages/reader-core/src/__tests__/multilingual-conformance.test.ts`.
 */


const FIXTURE_SLUGS: Record<MultilingualFixtureId, string> = {
  'ar-rtl': 'conformance-ar-rtl',
  'he-rtl': 'conformance-he-rtl',
  'ja-vertical': 'conformance-ja-vertical',
  'zh-ruby': 'conformance-zh-ruby',
  ko: 'conformance-ko',
  'mixed-bidi': 'conformance-mixed-bidi',
  'inbook-lang-switch': 'conformance-inbook-lang-switch',
};

function fixtureEpub(id: MultilingualFixtureId): Buffer {
  return buildMultilingualEpub(id);
}

function loginFor(id: MultilingualFixtureId) {
  return {
    ...LOGIN_RESPONSE,
    data: {
      ...LOGIN_RESPONSE.data,
      sessionToken: `conformance-${id}`,
      book: {
        id: `book-${id}`,
        slug: FIXTURE_SLUGS[id],
        title: 'Conformance Book',
        authorName: 'Matrix',
      },
    },
  };
}

function getBodyText(page: Page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    if (!iframe?.contentDocument?.body) return null;
    return iframe.contentDocument.body.textContent ?? null;
  });
}

function getIframeHtmlLang(page: Page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    return iframe?.contentDocument?.documentElement?.getAttribute('lang') ?? null;
  });
}

function getIframeComputedStyle(
  page: Page,
  selector: string,
  property: string,
) {
  return page.evaluate(
    ({ sel, prop }) => {
      const iframe = document.querySelector('iframe');
      const el = iframe?.contentDocument?.querySelector(sel);
      if (!el) return null;
      return iframe.contentWindow!.getComputedStyle(el).getPropertyValue(prop);
    },
    { sel: selector, prop: property },
  );
}

for (const id of Object.keys(FIXTURE_SLUGS) as MultilingualFixtureId[]) {
  test.describe(`Conformance: ${id}`, () => {
    test.beforeEach(async ({ page }) => {
      suppressWorkboxErrors(page);
      await mockReaderApi(page, {
        bookSlug: FIXTURE_SLUGS[id],
        epubUrl: `https://example.com/${FIXTURE_SLUGS[id]}.epub`,
        epubBuffer: fixtureEpub(id),
        loginResponse: loginFor(id),
      });
    });

    test('@mobile renders first chapter and navigates chapters', async ({ page }) => {
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      const initial = await getBodyText(page);
      expect(initial).not.toBeNull();

      await page.keyboard.press('ArrowRight');
      await expect.poll(getBodyText, { timeout: 15000 }).not.toBe(initial);
      await page.keyboard.press('ArrowLeft');
      await expect.poll(getBodyText, { timeout: 10000 }).toBe(initial);
    });

    test('keeps authored language and direction attributes in the rendered document', async ({
      page,
    }) => {
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      // Space lang is always asserted; RTL fixtures additionally pin dir.
      const lang = await getIframeHtmlLang(page);
      const expectedLang =
        id === 'ar-rtl' || id === 'he-rtl' || id === 'inbook-lang-switch' || id === 'mixed-bidi'
          ? 'ar'
          : id === 'ja-vertical'
            ? 'ja'
            : id === 'zh-ruby'
              ? 'zh'
              : 'ko';
      expect(lang).toBe(expectedLang);
      if (id === 'ar-rtl' || id === 'he-rtl') {
        const dir = await page.evaluate(() => {
          const iframe = document.querySelector('iframe');
          return iframe?.contentDocument?.documentElement?.getAttribute('dir') ?? null;
        });
        expect(dir).toBe('rtl');
      }
    });

    test('bidi isolation and ruby computed styles are applied in Chromium and WebKit', async ({
      page,
    }) => {
      if (id !== 'mixed-bidi' && id !== 'ar-rtl' && id !== 'inbook-lang-switch') return;
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      const isolation = await getIframeComputedStyle(page, 'span.bidi-run', 'unicode-bidi');
      expect(isolation).toBe('isolate');
    });

    test('app locale switch changes chrome strings but never rewrites publication text', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        localStorage.setItem(
          'do-epub-locale',
          JSON.stringify({ state: { locale: 'fr' }, version: 0 }),
        );
      });
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      // Chrome strings are localized (French "Contents"), even though the
      // publication itself remains in its authored language.
      await expect(page.getByRole('button', { name: 'Sommaire' })).toBeVisible();
      const lang = await getIframeHtmlLang(page);
      expect(lang).not.toBe('fr');
    });

    test('focus order reaches settings controls from the toolbar', async ({ page }) => {
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      await page.getByRole('button', { name: /Settings|Paramètres/i }).first().focus();
      let reachedPanel = false;
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        const active = page.evaluate(() => document.activeElement?.getAttribute('role') ?? '');
        if ((await active) === 'dialog') {
          reachedPanel = true;
          break;
        }
      }
      expect(reachedPanel).toBe(true);
    });

    test('desktop snapshot of the reader viewport', async ({ page }) => {
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      await page.waitForTimeout(2500);
      await expect(page.locator('iframe')).toHaveScreenshot(
        `${FIXTURE_SLUGS[id]}-desktop.png`,
      );
    });

    test('@mobile snapshot of the reader viewport', async ({ page }) => {
      await loginAsReader(page, FIXTURE_SLUGS[id]);
      await expect(page.getByRole('heading', { name: 'Conformance Book' })).toBeVisible({
        timeout: 30000,
      });
      await page.waitForTimeout(2500);
      await expect(page.locator('iframe')).toHaveScreenshot(`${FIXTURE_SLUGS[id]}-mobile.png`);
    });
  });
}
