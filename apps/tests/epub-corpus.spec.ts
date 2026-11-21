/**
 * Layer 2 of the #1483 durable EPUB corpus.
 *
 * Parametrized from the SAME manifest as Layer 1
 * (packages/testkit/src/epub-corpus). Each browserable fixture is generated
 * deterministically, mocked through the reader API, and loaded in the real
 * reader engine. Runs in Chromium + WebKit (and Firefox when the project is
 * enabled) — the existing apps/tests patterns apply (mockReaderApi +
 * loginAsReader).
 *
 * Registered but intentionally NOT part of the local default run? — they are,
 * like every other spec here, collected by the shared Playwright config; the
 * acceptance criterion is that the suite stays green on the CI lane. No
 * network is exercised: every request is mocked and fixtures are generated
 * in-process, so no binaries are vendored.
 */
import { CORPUS_ENTRIES, generateCorpusEntry } from '@do-epub-studio/testkit';
import {
  EPUB_CONTENT_FRAME_SELECTOR,
  loginAsReader,
  mockReaderApi,
  suppressWorkboxErrors,
} from './fixtures';

const BROWSERS: ('chromium' | 'webkit')[] = ['chromium', 'webkit'];

const browserable = CORPUS_ENTRIES.filter((e) => e.browserable);

function fixtureBuffer(id: string): Buffer {
  return Buffer.from(generateCorpusEntry(id));
}

test.describe('epub corpus layer 2: reader-engine browser rendering', () => {
  for (const entry of browserable) {
    test(`${entry.id} loads and renders in the reader engine`, async ({ page, browserName }) => {
      test.skip(
        !BROWSERS.includes(browserName as 'chromium' | 'webkit'),
        'Chromium/WebKit baseline only',
      );
      const epubBuffer = fixtureBuffer(entry.id);
      // The generated archive is deterministic — the harness must agree with
      // Layer 1 on what a browserable fixture looks like (valid archive).
      expect(epubBuffer.byteLength).toBeGreaterThan(100);

      await mockReaderApi(page, { epubBuffer });
      await loginAsReader(page);
      void suppressWorkboxErrors(page);

      const frame = page.frameLocator(EPUB_CONTENT_FRAME_SELECTOR).first();
      // First chapter of every browserable fixture renders an h1.
      await expect(frame.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

      // Navigation must be reachable: open the reader TOC panel.
      await page.getByRole('button', { name: 'Contents' }).click();
      await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();

      // Security fixtures must show sanitized content (no script/executable
      // material reaches the iframe DOM).
      if (entry.category === 'security') {
        const scriptCount = await frame.locator('script').count();
        expect(scriptCount).toBe(0);
        const dangerousAttrs = await frame
          .locator('[onclick], [onload], [onmouseover], [onerror]')
          .count();
        expect(dangerousAttrs).toBe(0);
      }
    });
  }
});
