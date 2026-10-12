#!/usr/bin/env node
// scripts/i18n-audit.mjs — do-harness "i18n" sensor runner (locale regression).
//
// Runs the text probe per locale and reports only locale-specific deltas
// (expansion overflow, RTL direction mismatch, wrong declared language) via
// WEB_AUDIT_LOCALES (comma-separated BCP-47 tags, baseline locale first).
// Activation: WEB_AUDIT_LOCALE_STORAGE_KEY (the app's persisted zustand
// locale — this app: `do-epub-locale`), else WEB_AUDIT_LOCALE_COOKIE, else
// WEB_AUDIT_LOCALE_PARAM (default "lang"). Every probe additionally asserts
// that the rendered document declares the requested language, so an app that
// ignores the activation mechanism fails instead of reporting OK.
// Findings exit 1 with the JSON report on stderr; missing routes, fewer
// than two locales, or a missing Playwright prints "SKIP:" and exits 0.

const routes = (process.env.WEB_AUDIT_ROUTES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (routes.length === 0) {
  console.log('SKIP: WEB_AUDIT_ROUTES is not set (comma-separated app routes)');
  process.exit(0);
}
const locales = (process.env.WEB_AUDIT_LOCALES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (locales.length < 2) {
  console.log('SKIP: WEB_AUDIT_LOCALES must list at least two locales (baseline first)');
  process.exit(0);
}
const base = process.env.WEB_AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
// Activation order: the app's own persisted state (this app hydrates its UI
// locale from `localStorage['do-epub-locale']`) beats a cookie, which beats a
// query parameter — the two generic mechanisms only work for apps that read
// them, and a probe that silently falls back to English produces no signal
// (A3/GOAP-304: the language assertion now fails loudly instead).
const switchVia = process.env.WEB_AUDIT_LOCALE_STORAGE_KEY
  ? { storageKey: process.env.WEB_AUDIT_LOCALE_STORAGE_KEY }
  : process.env.WEB_AUDIT_LOCALE_COOKIE
    ? { cookie: process.env.WEB_AUDIT_LOCALE_COOKIE }
    : { param: process.env.WEB_AUDIT_LOCALE_PARAM ?? 'lang' };

const { loadChromium } = await import('./web-ui/lib/playwright.mjs');
const chromium = await loadChromium();
if (!chromium) {
  console.log('SKIP: playwright is not installed in this workspace');
  process.exit(0);
}

const { auditLocales } = await import('./web-ui/lib/i18n-audit.mjs');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const findings = [];
  for (const route of routes) {
    const result = await auditLocales(page, {
      route: new URL(route, base).toString(),
      locales,
      switchVia,
    });
    findings.push(...result.findings);
  }
  if (findings.length > 0) {
    console.error(JSON.stringify(findings, null, 2));
    console.error(`FAIL: ${findings.length} locale-specific finding(s)`);
    process.exit(1);
  }
  console.log(`OK: no locale-specific regressions on ${routes.length} route(s)`);
} finally {
  await browser.close();
}
