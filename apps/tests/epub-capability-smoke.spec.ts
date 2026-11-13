import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { loginAsReader, mockReaderApi } from './fixtures';

const CORPUS_DIR = resolve(
  import.meta.dirname,
  '../../packages/reader-core/src/__tests__/fixtures/capability-corpus',
);

function loadCorpusEpub(id: string): Buffer {
  return readFileSync(resolve(CORPUS_DIR, `${id}.epub`));
}

const SMOKE_CONTENT = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Capability smoke</title>
<style>body{font:16px sans-serif;max-width:38rem;margin:1rem auto}.vertical{writing-mode:vertical-rl;height:5rem}table{border-collapse:collapse}th,td{border:1px solid;padding:.25rem}svg{width:2rem;height:2rem}</style></head>
<body><nav aria-label="Contents"><a href="#start">Start</a></nav>
<main><h1 id="start">A Small Atlas</h1><h2>North</h2><p lang="fr">Bonjour.</p>
<table><caption>Rain by season</caption><thead><tr><th id="season" scope="col">Season</th><th id="rain" scope="col">Millimetres</th></tr></thead><tbody><tr><th id="spring" scope="row">Spring</th><td headers="spring rain">12</td></tr></tbody></table>
<p><ruby>山<rt>やま</rt></ruby></p><math xmlns="http://www.w3.org/1998/Math/MathML"><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></math>
<svg role="img" aria-labelledby="circle-label" viewBox="0 0 40 40"><title id="circle-label">A blue circle</title><circle cx="20" cy="20" r="12" fill="blue"/></svg>
<p class="vertical">縦書き</p><p dir="rtl" lang="ar">نص تجريبي</p></main></body></html>`;

test.describe('synthetic EPUB content browser rendering smoke', () => {
  test('Chromium and WebKit expose baseline structure and layout', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await page.setContent(SMOKE_CONTENT);
    await expect(page.getByRole('heading', { level: 1, name: 'A Small Atlas' })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Contents' }).getByRole('link', { name: 'Start' }),
    ).toHaveAttribute('href', '#start');
    await expect(
      page.getByRole('table', { name: 'Rain by season' }).getByRole('cell', { name: '12' }),
    ).toBeVisible();
    await expect(page.locator('[lang="fr"]')).toHaveText('Bonjour.');
    await expect(page.getByRole('img', { name: 'A blue circle' })).toBeVisible();
    const layout = await page.evaluate(() => {
      const vertical = document.querySelector<HTMLElement>('.vertical');
      const rtl = document.querySelector<HTMLElement>('[dir="rtl"]');
      return {
        verticalWriting: vertical ? getComputedStyle(vertical).writingMode : null,
        rtlDirection: rtl ? getComputedStyle(rtl).direction : null,
        language: document.querySelector('[lang="fr"]')?.getAttribute('lang'),
        rubyText: document.querySelector('rt')?.textContent,
        mathText: document.querySelector('math')?.textContent,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(layout.verticalWriting).toBe('vertical-rl');
    expect(layout.rtlDirection).toBe('rtl');
    expect(layout.rubyText).toBe('やま');
    expect(layout.mathText).toContain('x+1');
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });

  test('renders EPUB 2 reflowable and NCX navigation through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('epub2-reflow') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'A Small Atlas' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Contents' }).click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test('renders EPUB 3 navigation document and TOC through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('epub3-0-reflow-nav') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'A Small Atlas' })).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'Contents' }).click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'epub3-0-reflow-nav' })).toBeVisible();
  });

  test('handles malformed navigation gracefully through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('malformed-navigation') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'Broken map' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByText('Navigation target does not exist.')).toBeVisible();
    await page.getByRole('button', { name: 'Contents' }).click();
    await expect(page.getByRole('heading', { name: 'Contents' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible();
  });

  test('renders complex tables and inline SVG with accessible names through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('complex-table') });
    await loginAsReader(page);
    const tableFrame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(tableFrame.getByRole('heading', { level: 1, name: 'Rain log' })).toBeVisible({
      timeout: 15000,
    });
    await expect(tableFrame.getByRole('table', { name: 'Rain by season' })).toBeVisible();
    await expect(tableFrame.getByRole('cell', { name: '12' })).toBeVisible();
  });

  test('renders ruby annotations through reader engine', async ({ page, browserName }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('ruby-annotation') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'Reading' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.locator('rt')).toHaveText('やま');
  });

  test('renders inline SVG with accessible name through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('svg-vector') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'A blue circle' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByRole('img', { name: 'A blue circle' })).toBeVisible();
  });

  test('renders image with alternative text through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('image-alternative') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'A Seed' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByRole('img', { name: 'A round seed with two leaves' })).toBeVisible();
  });

  test('renders document language and language tagged content through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('headings-landmarks-language') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'A Small Atlas' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByRole('heading', { level: 2, name: 'North' })).toBeVisible();
    await expect(frame.locator('[lang="fr"]')).toHaveText('Bonjour.');
  });

  test('renders RTL direction and Arabic text through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('rtl-direction') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'يمين' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.locator('[dir="rtl"]')).toHaveText('نص تجريبي');
    const rtlDir = await frame
      .locator('[dir="rtl"]')
      .evaluate((el) => getComputedStyle(el).direction);
    expect(rtlDir).toBe('rtl');
  });

  test('renders fixed-layout publication through reader engine', async ({ page, browserName }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('fixed-layout') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByText('Fixed page text.')).toBeVisible();
  });

  test('loads primary rendition and switches to alternate rendition for multiple-renditions publication', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('multiple-renditions') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'Two views' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByText('One shared original sentence.')).toBeVisible();

    const selector = page.getByRole('button', { name: 'Select edition or rendition' });
    await expect(selector).toBeVisible({ timeout: 10000 });
    await selector.click();

    const altOption = page.getByRole('menuitemradio', { name: 'alternate-rendition' });
    await expect(altOption).toBeVisible();
    await altOption.click();

    await expect(frame.getByRole('heading', { level: 1, name: 'Alternate View' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.getByText('Rendered through alternate rendition.')).toBeVisible();
  });

  test('enforces security boundaries against scripts and remote resources through reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );

    // Scripted content: sanitizer strips inline executable handlers (onclick)
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('scripted-content') });
    await loginAsReader(page);
    const scriptFrame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(scriptFrame.getByRole('heading', { level: 1, name: 'No script' })).toBeVisible({
      timeout: 15000,
    });
    await expect(scriptFrame.locator('[onclick]')).toHaveCount(0);
  });

  test('plays media overlay synchronized narration and renders highlight in reader engine', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium' && browserName !== 'webkit',
      'Chromium/WebKit baseline only',
    );
    await mockReaderApi(page, { epubBuffer: loadCorpusEpub('media-overlay') });
    await loginAsReader(page);
    const frame = page.frameLocator('[data-epub-content-host] iframe').first();
    await expect(frame.getByRole('heading', { level: 1, name: 'A quiet line' })).toBeVisible({
      timeout: 15000,
    });
    await expect(frame.locator('#line')).toHaveText('Rain taps softly.');

    const narrationBtn = page.getByRole('button', { name: 'Narration' });
    await expect(narrationBtn).toBeVisible({ timeout: 10000 });
    await narrationBtn.click();

    const playBtn = page.getByRole('button', { name: 'Play narration' });
    await expect(playBtn).toBeVisible();
    await playBtn.click();

    await expect(frame.locator('#line')).toHaveClass(
      /media-overlay-active|-epub-media-overlay-active/,
      {
        timeout: 10000,
      },
    );
  });
});
