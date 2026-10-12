#!/usr/bin/env node
// scripts/perf-audit.mjs — do-harness "perf" sensor runner (Lighthouse CWV).
//
// Runs Lighthouse (peer dependency; "SKIP:" when absent) against each route
// and evaluates the extracted Core Web Vitals against budgets. Budgets come
// from WEB_PERF_BUDGETS (JSON, keys: performanceScore/lcpMs/cls/tbtMs) with
// defaults LCP<=2500ms, CLS<=0.1, TBT<=600ms, score>=0.9. CHROME_PATH is set
// to the workspace's Playwright chromium so no separate Chrome install is
// needed. A route with no usable measurements prints "SKIP:" (budgets not
// evaluated) instead of the OK line — absence is never reported as met
// (F6, GOAP-290).

const routes = (process.env.WEB_AUDIT_ROUTES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (routes.length === 0) {
  console.log('SKIP: WEB_AUDIT_ROUTES is not set (comma-separated app routes)');
  process.exit(0);
}
const base = process.env.WEB_AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const budgets = process.env.WEB_PERF_BUDGETS;

const { loadChromium } = await import('./web-ui/lib/playwright.mjs');
const chromium = await loadChromium();
if (!chromium) {
  console.log('SKIP: playwright is not installed in this workspace');
  process.exit(0);
}

const { auditPerformance, missingMetrics } = await import('./web-ui/lib/perf-audit.mjs');
const browser = await chromium.launch();
try {
  const chromePath = chromium.executablePath();
  const findings = [];
  const unmeasured = [];
  for (const route of routes) {
    const result = await auditPerformance({
      url: new URL(route, base).toString(),
      budgets,
      chromePath,
    });
    if (result.skipped) {
      console.log(`SKIP: ${result.skipped}`);
      process.exit(0);
    }
    const missing = missingMetrics(result.metrics);
    if (missing.length > 0) unmeasured.push(`${route} (${missing.join(', ')})`);
    findings.push(...result.findings);
  }
  if (findings.length > 0) {
    console.error(JSON.stringify(findings, null, 2));
    console.error(`FAIL: ${findings.length} performance budget breach(es)`);
    process.exit(1);
  }
  if (unmeasured.length > 0) {
    console.log(
      `SKIP: no usable performance measurements on ${unmeasured.length}/${routes.length} route(s): ${unmeasured.join('; ')} — budgets not evaluated`,
    );
    process.exit(0);
  }
  console.log(`OK: performance budgets met on ${routes.length} route(s)`);
} finally {
  await browser.close();
}
