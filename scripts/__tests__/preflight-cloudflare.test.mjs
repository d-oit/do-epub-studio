import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  extractResourceBindings,
  resolveCloudflareCredentials,
  runPreflight,
  verifyCloudflareResources,
} from '../preflight-cloudflare.mjs';

const configPath = fileURLToPath(new URL('../../wrangler.toml', import.meta.url));
const sampleConfig = {
  d1_databases: [{ binding: 'DB', database_name: 'prod-db', database_id: 'prod-db-id' }],
  kv_namespaces: [{ binding: 'CACHE_KV', id: 'prod-kv-id' }],
  r2_buckets: [{ binding: 'BOOKS_BUCKET', bucket_name: 'prod-books' }],
  env: {
    preview: {
      d1_databases: [{ binding: 'DB', database_name: 'preview-db', database_id: 'preview-db-id' }],
      kv_namespaces: [{ binding: 'CACHE_KV', id: 'preview-kv-id' }],
      r2_buckets: [{ binding: 'BOOKS_BUCKET', bucket_name: 'preview-books' }],
    },
  },
};

function apiResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function successfulApiResponse() {
  return apiResponse(200, { success: true, result: {} });
}

function allResources() {
  return extractResourceBindings(sampleConfig);
}

describe('preflight-cloudflare', () => {
  it('extracts each resource for production and preview independently', () => {
    expect(allResources()).toEqual({
      production: {
        d1: sampleConfig.d1_databases,
        kv: sampleConfig.kv_namespaces,
        r2: sampleConfig.r2_buckets,
      },
      preview: {
        d1: sampleConfig.env.preview.d1_databases,
        kv: sampleConfig.env.preview.kv_namespaces,
        r2: sampleConfig.env.preview.r2_buckets,
      },
    });
  });

  it('verifies declared resources through their resource-specific API endpoints', async () => {
    const requestedUrls = [];
    const fetchImpl = vi.fn(async (url) => {
      requestedUrls.push(new URL(url).pathname);
      return successfulApiResponse();
    });

    const result = await verifyCloudflareResources({
      accountId: 'test-account',
      token: 'test-token',
      bindings: allResources(),
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.verified).toHaveLength(6);
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        '/client/v4/accounts/test-account/d1/database/prod-db-id',
        '/client/v4/accounts/test-account/d1/database/preview-db-id',
        '/client/v4/accounts/test-account/storage/kv/namespaces/prod-kv-id',
        '/client/v4/accounts/test-account/storage/kv/namespaces/preview-kv-id',
        '/client/v4/accounts/test-account/r2/buckets/prod-books',
        '/client/v4/accounts/test-account/r2/buckets/preview-books',
      ]),
    );
  });

  it('reports only 404 resources as missing', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const path = new URL(url).pathname;
      if (
        path.endsWith('/d1/database/prod-db-id') ||
        path.endsWith('/namespaces/prod-kv-id') ||
        path.endsWith('/r2/buckets/prod-books')
      ) {
        return apiResponse(404, { success: false, errors: [{ code: 1001, message: 'Not found' }] });
      }
      return successfulApiResponse();
    });

    const result = await verifyCloudflareResources({
      accountId: 'test-account',
      token: 'test-token',
      bindings: allResources(),
      fetchImpl,
    });

    expect(result.issues.map(({ type, name }) => ({ type, name }))).toEqual([
      { type: 'D1_MISSING', name: 'prod-db' },
      { type: 'KV_MISSING', name: 'CACHE_KV' },
      { type: 'R2_MISSING', name: 'prod-books' },
    ]);
  });

  it('identifies R2 activation error 10042 and gives account-owner remediation', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (new URL(url).pathname.includes('/r2/buckets/')) {
        return apiResponse(403, {
          success: false,
          errors: [{ code: 10042, message: 'Please enable R2 through the Cloudflare Dashboard.' }],
        });
      }
      return successfulApiResponse();
    });

    const result = await verifyCloudflareResources({
      accountId: 'test-account',
      token: 'test-token',
      bindings: allResources(),
      fetchImpl,
    });

    expect(result.issues).toHaveLength(2);
    expect(result.issues.map(({ type, code }) => ({ type, code }))).toEqual([
      { type: 'R2_UNPROVISIONED', code: 10042 },
      { type: 'R2_UNPROVISIONED', code: 10042 },
    ]);
    expect(result.issues[0].resolution).toContain('dash.cloudflare.com/test-account/r2/overview');
    expect(result.issues[0].resolution).toContain('wrangler r2 bucket create prod-books');
  });

  it('does not misreport permission failures as missing resources or unprovisioned R2', async () => {
    const fetchImpl = vi.fn(async () =>
      apiResponse(403, { success: false, errors: [{ code: 10000, message: 'Permission denied' }] }),
    );

    const result = await verifyCloudflareResources({
      accountId: 'test-account',
      token: 'test-token',
      bindings: allResources(),
      fetchImpl,
    });

    expect(result.issues).toHaveLength(6);
    expect(new Set(result.issues.map(({ type }) => type))).toEqual(
      new Set(['D1_API_ERROR', 'KV_API_ERROR', 'R2_API_ERROR']),
    );
  });

  it('requires explicit API token and account ID instead of inferring an account', () => {
    expect(resolveCloudflareCredentials({})).toBeNull();
    expect(resolveCloudflareCredentials({ CLOUDFLARE_API_TOKEN: 'token' })).toBeNull();
    expect(resolveCloudflareCredentials({ CLOUDFLARE_ACCOUNT_ID: 'account' })).toBeNull();
    expect(
      resolveCloudflareCredentials({
        CLOUDFLARE_API_TOKEN: 'token',
        CLOUDFLARE_ACCOUNT_ID: 'account',
      }),
    ).toEqual({ token: 'token', accountId: 'account' });
  });

  it('fails closed when remote credentials are absent', async () => {
    const log = { error: vi.fn(), log: vi.fn() };
    const fetchImpl = vi.fn();

    const result = await runPreflight({ configPath, env: {}, log, fetchImpl });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('CREDENTIALS_MISSING');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('remote verification is required'),
    );
  });

  it('uses Wrangler configuration and checks the actual production and preview bindings', async () => {
    const requestedUrls = [];
    const result = await runPreflight({
      configPath,
      env: { CLOUDFLARE_API_TOKEN: 'test-token', CLOUDFLARE_ACCOUNT_ID: 'test-account' },
      log: { error: vi.fn(), log: vi.fn() },
      fetchImpl: vi.fn(async (url) => {
        requestedUrls.push(new URL(url).pathname);
        return successfulApiResponse();
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.verified).toHaveLength(6);
    expect(requestedUrls).toContain(
      '/client/v4/accounts/test-account/r2/buckets/do-epub-studio-books',
    );
    expect(requestedUrls).toContain(
      '/client/v4/accounts/test-account/r2/buckets/do-epub-studio-books-preview',
    );
  });
});
