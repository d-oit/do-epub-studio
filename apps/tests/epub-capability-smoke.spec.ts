import { expect, test } from '@playwright/test';

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
});
