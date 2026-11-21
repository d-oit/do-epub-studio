#!/usr/bin/env node
/**
 * Deployment smoke test for API routing (issue #1482).
 *
 * Verifies that `/api/*` on a deployed origin answers JSON from Cloudflare
 * Pages Functions — never an SPA HTML fallback with status 200. This is the
 * regression guard for incident #1014 (Render served `index.html` at
 * `/api/*`, breaking catalog, auth, and reader loading).
 *
 * Checks (all fail-closed, any failure exits non-zero):
 *  1. `GET /api/health` → 200 JSON `{"ok":true}` (liveness probe, ADR-252).
 *  2. `GET /api/catalog?limit=1&offset=0` → 200 `application/json` with a
 *     schema-valid envelope (`ok`, `data.items`, `data.total`, `data.page`,
 *     `data.pageSize`, `data.hasMore`); a 200 HTML response fails loudly.
 *  3. `GET /api/admin/books` (unauthenticated) → 401 JSON, never HTML.
 *  4. `GET /api/files/<uuid>/<missing>` → non-HTML error (400/401/403/404).
 *
 * Usage:
 *   node scripts/deploy-smoke.mjs --base-url https://do-epub-studio.pages.dev
 *   node scripts/deploy-smoke.mjs --base-url <url> --retries 12 \
 *       --expect-origin https://do-epub-studio.pages.dev
 *
 * `--expect-origin` runs the same origin validation the build applies to
 * `VITE_API_BASE_URL` (valid https, no placeholders, no SPA-only host); an
 * invalid value fails immediately. An absent origin is valid only because the
 * canonical topology co-hosts Pages Functions on the frontend origin.
 */
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 5_000;

/** Known hosts whose `/api/*` is not served by Pages Functions (SPA fallback). */
const SPA_ONLY_HOST_SUFFIXES = ['onrender.com', 'vercel.app', 'netlify.app', 'github.io'];

/**
 * Validate a target origin (mirrors apps/web/src/config/api-origin.ts).
 * Missing/empty origin resolves to same-origin `/api/*` (Pages-only
 * assumption); `allowMissing: false` requires an explicit value.
 */
export function validateApiOriginValue(raw, { allowMissing = true } = {}) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    if (allowMissing) return { ok: true, resolution: 'same-origin' };
    return { ok: false, reason: 'origin is missing' };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: `"${value}" is not a valid absolute URL` };
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') {
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (!isLocal) {
      return { ok: false, reason: `must use https (got "${url.protocol}")` };
    }
  }
  if (url.username || url.password || url.hash || url.search) {
    return { ok: false, reason: 'origin must not embed credentials, a fragment, or query' };
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    return { ok: false, reason: `origin must have no path (got "${url.pathname}")` };
  }

  const lowered = value.toLowerCase();
  if (hostname === 'example.com' || hostname.endsWith('.example.com')) {
    return { ok: false, reason: `"${hostname}" is a placeholder domain (example.com)` };
  }
  if (hostname === 'workers.dev' || hostname.endsWith('.workers.dev')) {
    return { ok: false, reason: `"${hostname}" is a Workers placeholder origin` };
  }
  if (hostname === 'worker.dev' || hostname.endsWith('.worker.dev')) {
    return { ok: false, reason: `"${hostname}" is a Workers placeholder origin` };
  }
  if (value.includes('<') || value.includes('>')) {
    return { ok: false, reason: 'contains angle-bracket placeholder markers' };
  }
  if (lowered.includes('placeholder') || lowered.includes('replaceme') || lowered.includes('replace-me')) {
    return { ok: false, reason: 'contains a placeholder marker' };
  }
  const spaHost = SPA_ONLY_HOST_SUFFIXES.find(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
  if (spaHost) {
    return {
      ok: false,
      reason: `"${hostname}" is a known SPA-only host (${spaHost}) whose /api/* is not served by Pages Functions (incident #1014)`,
    };
  }

  return { ok: true, resolution: `${url.protocol}//${url.host}` };
}

async function doHttpGet(fetchImpl, url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'application/json' },
    });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    let json = null;
    if (contentType.includes('json')) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { status: res.status, contentType, text, json };
  } finally {
    clearTimeout(timer);
  }
}

function isHtml(contentType, text) {
  return contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE');
}

function checkHealth(baseUrl, fetchImpl, timeoutMs) {
  return doHttpGet(fetchImpl, `${baseUrl}/api/health`, timeoutMs).then((r) => {
    if (r.status !== 200) {
      return { name: '/api/health', pass: false, detail: `expected 200, got ${r.status}` };
    }
    if (isHtml(r.contentType, r.text)) {
      return { name: '/api/health', pass: false, detail: 'returned HTML instead of JSON (SPA fallback)' };
    }
    if (!r.json || r.json.ok !== true) {
      return { name: '/api/health', pass: false, detail: 'expected JSON {"ok":true}' };
    }
    return { name: '/api/health', pass: true, detail: '200 JSON {"ok":true}' };
  });
}

function checkCatalog(baseUrl, fetchImpl, timeoutMs) {
  const url = `${baseUrl}/api/catalog?limit=1&offset=0`;
  return doHttpGet(fetchImpl, url, timeoutMs).then((r) => {
    if (r.status !== 200) {
      return { name: '/api/catalog', pass: false, detail: `expected 200, got ${r.status}` };
    }
    if (isHtml(r.contentType, r.text)) {
      return {
        name: '/api/catalog',
        pass: false,
        detail: 'returned HTML with 200 (SPA fallback — incident #1014)',
      };
    }
    if (!r.json || r.json.ok !== true) {
      return { name: '/api/catalog', pass: false, detail: 'expected JSON envelope with ok:true' };
    }
    const data = r.json.data;
    if (!data || !Array.isArray(data.items) || typeof data.total !== 'number' || typeof data.page !== 'number' || typeof data.pageSize !== 'number' || typeof data.hasMore !== 'boolean') {
      return { name: '/api/catalog', pass: false, detail: 'envelope missing items/total/page/pageSize/hasMore' };
    }
    return { name: '/api/catalog', pass: true, detail: '200 JSON catalog envelope' };
  });
}

function checkProtectedRoute(baseUrl, fetchImpl, timeoutMs) {
  return doHttpGet(fetchImpl, `${baseUrl}/api/admin/books`, timeoutMs).then((r) => {
    if (r.status !== 401) {
      return { name: '/api/admin/books', pass: false, detail: `expected 401 unauthenticated, got ${r.status}` };
    }
    if (isHtml(r.contentType, r.text)) {
      return { name: '/api/admin/books', pass: false, detail: 'returned HTML instead of 401 JSON' };
    }
    if (!r.json || r.json.ok !== false || !r.json.error?.code) {
      return { name: '/api/admin/books', pass: false, detail: 'expected JSON error envelope with code' };
    }
    return { name: '/api/admin/books', pass: true, detail: '401 JSON (unauthenticated)' };
  });
}

function checkFileEndpoint(baseUrl, fetchImpl, timeoutMs) {
  const url = `${baseUrl}/api/files/00000000-0000-0000-0000-000000000000/nonexistent.epub`;
  return doHttpGet(fetchImpl, url, timeoutMs).then((r) => {
    if (r.status === 200) {
      return { name: '/api/files/…', pass: false, detail: 'expected non-200 error for a missing signed file' };
    }
    if (![400, 401, 403, 404].includes(r.status)) {
      return { name: '/api/files/…', pass: false, detail: `expected 400/401/403/404, got ${r.status}` };
    }
    if (isHtml(r.contentType, r.text)) {
      return { name: '/api/files/…', pass: false, detail: 'returned HTML instead of a JSON/stream error' };
    }
    return { name: '/api/files/…', pass: true, detail: `${r.status} non-HTML` };
  });
}

/**
 * Run all four smoke checks against `baseUrl` using `fetchImpl` (injectable
 * for tests). Returns `{ ok, results }`; each result is `{ name, pass,
 * detail }`.
 */
export async function runSmokeChecks({ baseUrl, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const checks = [checkHealth, checkCatalog, checkProtectedRoute, checkFileEndpoint];
  const results = await Promise.all(checks.map((check) => check(baseUrl, fetchImpl, timeoutMs)));
  return { ok: results.every((result) => result.pass), results };
}

async function runWithRetries({ baseUrl, fetchImpl = fetch, retries = 0, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const outcome = await runSmokeChecks({ baseUrl, fetchImpl, timeoutMs });
    if (outcome.ok || attempt === retries) return outcome;
    if (attempt < retries) await sleep(RETRY_DELAY_MS);
  }
  // Unreachable: the loop returns on the final attempt.
  return { ok: false, results: [] };
}

function printOutcome(outcome) {
  for (const result of outcome.results) {
    const mark = result.pass ? '✔' : '✘';
    console.log(`${mark} ${result.name} — ${result.detail}`);
  }
  const passed = outcome.results.filter((result) => result.pass).length;
  console.log(`deploy smoke ${outcome.ok ? 'PASSED' : 'FAILED'} (${passed}/${outcome.results.length} checks passed)`);
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        'base-url': { type: 'string' },
        'expect-origin': { type: 'string' },
        retries: { type: 'string' },
        'timeout-ms': { type: 'string' },
      },
    });
  } catch (error) {
    console.error(`[deploy-smoke] invalid arguments: ${error.message}`);
    process.exit(2);
  }

  const { values } = parsed;
  const baseUrl = values['base-url'];
  if (!baseUrl) {
    console.error('usage: node scripts/deploy-smoke.mjs --base-url <url> [--expect-origin <url>] [--retries <n>] [--timeout-ms <n>]');
    process.exit(2);
  }

  const originCheck = validateApiOriginValue(baseUrl, { allowMissing: false });
  if (!originCheck.ok) {
    console.error(`[deploy-smoke] --base-url is not a supported API origin: ${originCheck.reason}`);
    process.exit(1);
  }

  if (values['expect-origin']) {
    const expected = validateApiOriginValue(values['expect-origin'], { allowMissing: false });
    if (!expected.ok) {
      console.error(`[deploy-smoke] --expect-origin is invalid: ${expected.reason}`);
      process.exit(1);
    }
  }

  const retries = Math.max(0, Number.parseInt(values.retries ?? '0', 10) || 0);
  const timeoutMs = Math.max(1_000, Number.parseInt(values['timeout-ms'] ?? '', 10) || DEFAULT_TIMEOUT_MS);
  const outcome = await runWithRetries({ baseUrl, retries, timeoutMs });
  printOutcome(outcome);
  process.exit(outcome.ok ? 0 : 1);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  await main();
}
