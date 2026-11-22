import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateApiOriginValue, runSmokeChecks } from '../deploy-smoke.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, '../deploy-smoke.mjs');

function htmlResponse(status = 200) {
  return new Response('<!DOCTYPE html><html><body>SPA</body></html>', {
    status,
    headers: { 'content-type': 'text/html' },
  });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const HEALTH_OK = { ok: true, service: 'do-epub-studio-worker' };
const CATALOG_OK = {
  ok: true,
  data: { items: [{ id: '1' }], total: 1, page: 1, pageSize: 1, hasMore: false },
};
const UNAUTHORIZED = { ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } };
const FILE_MISSING = { ok: false, error: { code: 'NOT_FOUND', message: 'File' } };

function allHtmlFetch() {
  return async () => htmlResponse(200);
}

function validJsonFetch() {
  return async (url) => {
    if (url.endsWith('/api/health')) return jsonResponse(HEALTH_OK);
    if (url.includes('/api/catalog')) return jsonResponse(CATALOG_OK);
    if (url.includes('/api/admin/books')) return jsonResponse(UNAUTHORIZED, 401);
    if (url.includes('/api/files/')) return jsonResponse(FILE_MISSING, 404);
    return htmlResponse(404);
  };
}

describe('validateApiOriginValue', () => {
  it('accepts a valid https origin', () => {
    const result = validateApiOriginValue('https://do-epub-studio.pages.dev', {
      allowMissing: false,
    });
    expect(result.ok).toBe(true);
  });

  it('allows a missing origin (same-origin /api/* on Pages)', () => {
    expect(validateApiOriginValue(undefined).ok).toBe(true);
    expect(validateApiOriginValue('  ').ok).toBe(true);
    expect(validateApiOriginValue(undefined, { allowMissing: false }).ok).toBe(false);
  });

  it('rejects malformed, http (non-local), placeholder, and SPA-only origins', () => {
    for (const raw of [
      'not a url',
      'http://api.example.com',
      'https://example.com',
      'https://my-worker.workers.dev',
      'https://<your-worker>.workers.dev',
      'https://do-epub-studio.onrender.com',
      'https://do-epub-studio.vercel.app',
      'https://api.example.com/api',
    ]) {
      expect(validateApiOriginValue(raw, { allowMissing: false }).ok).toBe(false);
    }
  });

  it('allows http for localhost smoke testing', () => {
    expect(validateApiOriginValue('http://localhost:8787', { allowMissing: false }).ok).toBe(true);
  });
});

describe('runSmokeChecks', () => {
  const baseUrl = 'https://do-epub-studio.pages.dev';

  it('fails when /api/* returns HTML with 200 (incident #1014)', async () => {
    const outcome = await runSmokeChecks({ baseUrl, fetchImpl: allHtmlFetch() });
    expect(outcome.ok).toBe(false);
    const catalog = outcome.results.find((result) => result.name === '/api/catalog');
    expect(catalog.pass).toBe(false);
    expect(catalog.detail).toMatch(/HTML/);
  });

  it('fails when health passes but catalog is HTML-200', async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith('/api/health')) return jsonResponse(HEALTH_OK);
      return htmlResponse(200);
    };
    const outcome = await runSmokeChecks({ baseUrl, fetchImpl });
    expect(outcome.ok).toBe(false);
    expect(outcome.results.find((result) => result.name === '/api/health').pass).toBe(true);
  });

  it('fails when the protected route returns 200 HTML instead of 401 JSON', async () => {
    const fetchImpl = async (url) => {
      if (url.endsWith('/api/health')) return jsonResponse(HEALTH_OK);
      if (url.includes('/api/catalog')) return jsonResponse(CATALOG_OK);
      return htmlResponse(200);
    };
    const outcome = await runSmokeChecks({ baseUrl, fetchImpl });
    expect(outcome.ok).toBe(false);
    const protectedCheck = outcome.results.find((result) => result.name === '/api/admin/books');
    expect(protectedCheck.pass).toBe(false);
  });

  it('passes when every endpoint answers JSON per contract', async () => {
    const outcome = await runSmokeChecks({ baseUrl, fetchImpl: validJsonFetch() });
    expect(outcome.ok).toBe(true);
    expect(outcome.results).toHaveLength(4);
    for (const result of outcome.results) {
      expect(result.pass).toBe(true);
    }
  });
});

describe('deploy-smoke CLI', () => {
  it('exits non-zero with usage when --base-url is missing', () => {
    const result = spawnSync('node', [scriptPath], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/--base-url/);
  });

  it('exits non-zero when --expect-origin is a placeholder', () => {
    const result = spawnSync(
      'node',
      [
        scriptPath,
        '--base-url',
        'https://do-epub-studio.pages.dev',
        '--expect-origin',
        'https://example.com',
      ],
      {
        encoding: 'utf8',
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/expect-origin is invalid/);
  });
});
