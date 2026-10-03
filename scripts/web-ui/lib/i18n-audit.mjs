// i18n-audit.mjs — locale-regression sensor for the web-ui pack.
//
// Runs the existing text probe per locale and reports only what is
// LOCALE-SPECIFIC: findings that appear under a non-baseline locale but not
// under the baseline (German text expansion overflowing a container, an RTL
// locale rendered with LTR direction, etc.). Global defects are the
// viewport-ux sensor's job; this sensor isolates the per-locale delta so a
// baseline-locale defect does not drown out the signal.
//
// Locale switching is app-specific, so the sensor supports three mechanisms:
// a URL query parameter (`switchVia: { param: "lang" }`), a cookie
// (`switchVia: { cookie: "locale" }`), or the app's own persisted UI state
// (`switchVia: { storageKey: "do-epub-locale" }` — this app keeps it in
// `localStorage` under a zustand-persist envelope, which the sensor writes
// before loading the route; A3/GOAP-304). The persisted state is the real
// mechanism: an app that reads only its own switcher cannot be driven by a
// query parameter the product does not consume.
//
// Two contracts are validated on the document AFTER the locale loads:
// direction against the locale's expected writing direction (WCAG 3.1.1/3.1.2)
// and the declared language (`html[lang]`) against the requested locale — a
// `de` probe that renders English is a locale-activation failure, not an OK.

/**
 * Locales whose writing direction is right-to-left (BCP-47 primary language
 * subtag). Everything else defaults to LTR.
 */
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi']);

/**
 * @param {string} locale — BCP-47 tag (e.g. "ar", "pt-BR", "zh-Hans-CN").
 * @returns {"rtl" | "ltr"}
 */
export function expectedDirection(locale) {
  const primary = String(locale).toLowerCase().split('-')[0];
  return RTL_LANGUAGES.has(primary) ? 'rtl' : 'ltr';
}

/**
 * Build the URL for one route x locale via a query parameter.
 * @param {string} route — absolute URL or path with any existing search.
 * @param {string} param
 * @param {string} locale
 */
export function buildLocaleUrl(route, param, locale) {
  const url = new URL(route, 'http://localhost');
  url.searchParams.set(param, locale);
  return url.toString();
}

/**
 * Primary language subtag the document must declare for a requested locale
 * (`pt-BR` → `pt`). Matches `html[lang]` written by the app's locale effect.
 * @param {string} locale — BCP-47 tag.
 */
export function expectedLanguage(locale) {
  return String(locale).toLowerCase().split('-')[0];
}

/**
 * The value this app's zustand `persist` writes for its UI locale
 * (`stores/locale.ts`: `persist(..., { name: 'do-epub-locale' })`). The sensor
 * writes the same envelope so the store hydrates into the requested locale
 * before the route renders — a query parameter or cookie would be a second
 * precedence convention the product does not implement.
 *
 * The tag is reduced to its primary subtag because that is the key the catalogs
 * use (`availableLocales()`: `en`, `de`, `ar`, …). Writing a regional tag
 * verbatim would put `de-DE` into `html[lang]` while every lookup fell back to
 * English — the app would *declare* a language it cannot render, and a
 * primary-subtag comparison would call that OK. That is the false-OK class A3
 * exists to eliminate, so normalization happens at the source (the store also
 * rejects values outside the catalog set — see `stores/locale.ts`).
 */
export function persistedLocalePayload(locale) {
  return JSON.stringify({ state: { locale: expectedLanguage(locale) }, version: 0 });
}

/** Stable key for cross-locale finding comparison. */
export function keyFinding(finding) {
  return `${finding.stage}|${finding.selector}|${finding.reason}`;
}

/**
 * Findings present under one locale but absent from the baseline locale.
 * @param {Array<object>} baselineFindings
 * @param {Array<object>} localeFindings
 */
export function diffLocaleFindings(baselineFindings, localeFindings) {
  const baseline = new Set(baselineFindings.map(keyFinding));
  return localeFindings.filter((f) => !baseline.has(keyFinding(f)));
}

/**
 * Audit one route across locales.
 *
 * @param {import('playwright').Page} page — un-navigated; this function owns
 *   navigation so it can set locale state before each load.
 * @param {{ route: string, locales: string[], baselineLocale?: string,
 *           switchVia: { param?: string, cookie?: string, storageKey?: string },
 *           allowlist?: string[], maxFindings?: number }} options
 * @returns {Promise<{ route: string, findings: Array<object> }>} findings are
 *   locale-only deltas plus any language/direction mismatches.
 */
export async function auditLocales(page, options) {
  const { pageProbe } = await import('./page-probe.mjs');
  const locales = options.locales;
  if (!Array.isArray(locales) || locales.length < 2) {
    throw new TypeError('locales must list at least two entries (baseline first)');
  }
  const baselineLocale = options.baselineLocale ?? locales[0];
  if (!locales.includes(baselineLocale)) {
    throw new TypeError(`baseline locale ${baselineLocale} must be in locales`);
  }
  const switchVia = options.switchVia ?? {};

  /** Declared language and direction of the document the probe just rendered. */
  const readDocumentLocale = () =>
    page.evaluate(() => ({
      dir: document.documentElement.getAttribute('dir'),
      lang: document.documentElement.getAttribute('lang'),
    }));

  const runProbe = async (locale) => {
    const url = switchVia.param
      ? buildLocaleUrl(options.route, switchVia.param, locale)
      : options.route;
    if (switchVia.cookie) {
      await page
        .context()
        .addCookies([{ name: switchVia.cookie, value: locale, url: url.origin ?? url }]);
    }
    if (switchVia.storageKey) {
      // The app reads its own persisted state on boot, so it must exist before
      // the route's first load: reach the origin, write the envelope, load again.
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.evaluate(
        ([key, value]) => {
          localStorage.setItem(key, value);
        },
        [switchVia.storageKey, persistedLocalePayload(locale)],
      );
    }
    await page.goto(url, { waitUntil: 'networkidle' });
    const probe = await page.evaluate(pageProbe, {
      allowlist: options.allowlist ?? [],
      maxFindings: options.maxFindings ?? 50,
      checkFocusVisibility: false,
      viewport: { width: page.viewportSize().width, height: page.viewportSize().height },
    });
    return { probe, document: await readDocumentLocale() };
  };

  const findings = [];
  const baseline = await runProbe(baselineLocale);
  for (const locale of locales) {
    const isBaseline = locale === baselineLocale;
    const result = isBaseline ? baseline : await runProbe(locale);

    // Language contract: the document must declare the locale under test. A
    // probe that renders English while claiming `de` produced no usable delta,
    // so this is reported for the baseline too — if activation fails there,
    // every comparison downstream is meaningless.
    if (expectedLanguage(result.document.lang ?? '') !== expectedLanguage(locale)) {
      findings.push({
        stage: 'i18n-locale-not-applied',
        selector: 'html',
        route: options.route,
        locale,
        reason: `document lang is '${result.document.lang ?? 'unset'}' but the ${locale} probe requested that locale — locale activation failed (WCAG 3.1.1)`,
      });
    }

    if (isBaseline) continue;

    // Direction contract: a rendered RTL locale must carry dir="rtl" (WCAG
    // 3.1.1/3.1.2) — check the document element, not the probe. This check
    // runs AFTER runProbe(locale) navigated: judging before navigation reads
    // the previous locale's document (F5, GOAP-290).
    if ((result.document.dir ?? 'ltr') !== expectedDirection(locale)) {
      findings.push({
        stage: 'i18n-direction',
        selector: 'html',
        route: options.route,
        locale,
        reason: `document dir is '${result.document.dir ?? 'unset'}' but locale ${locale} expects '${expectedDirection(locale)}' (WCAG 3.1.2)`,
      });
    }
    for (const delta of diffLocaleFindings(baseline.probe.findings, result.probe.findings)) {
      findings.push({ ...delta, route: options.route, locale });
    }
  }
  return { route: options.route, findings };
}
