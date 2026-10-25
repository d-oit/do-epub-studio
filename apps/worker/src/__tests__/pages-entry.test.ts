import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';
import { generateSignedUrl } from '../storage/signed-url';

const { fetchApp, registerWasm } = vi.hoisted(() => ({
  fetchApp: vi.fn(),
  registerWasm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../app', () => ({ app: { fetch: fetchApp } }));
vi.mock('../lib/register-argon2-wasm', () => ({ registerArgon2Wasm: registerWasm }));

// Import the entry Wrangler discovers when Pages deploy runs at repository root.
import { onRequest } from '../../../../functions/api/[[path]]';

describe('Pages preview deployment origin', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves signed demo files on the requesting preview, retaining its resource bindings', async () => {
    const env = {
      ENVIRONMENT: 'preview',
      APP_BASE_URL: 'https://production.example',
      WEBAUTHN_RP_ID: 'production.example',
      WEBAUTHN_ORIGIN: 'https://production.example',
      SESSION_SIGNING_SECRET: 'TEST-ONLY-pages-signing-secret',
      DB: {},
      BOOKS_BUCKET: { head: vi.fn().mockResolvedValue(null) },
    } as unknown as Env;
    fetchApp.mockImplementation(async (_request: Request, effective: Env) => {
      const signed = await generateSignedUrl(effective, 'demo-book', 'books/demo.epub');
      return Response.json(signed);
    });

    const response = await onRequest({
      request: new Request('https://demo-preview.example/api/books/demo-book/file-url'),
      env,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
    });
    const body = await response.json<{ url: string }>();
    expect(new URL(body.url).origin).toBe('https://demo-preview.example');
    const effective = fetchApp.mock.lastCall?.[1] as Env;
    expect(effective.DB).toBe(env.DB);
    expect(effective.BOOKS_BUCKET).toBe(env.BOOKS_BUCKET);
    expect(effective.WEBAUTHN_RP_ID).toBe('demo-preview.example');
    expect(effective.WEBAUTHN_ORIGIN).toBe('https://demo-preview.example');
    expect(env.APP_BASE_URL).toBe('https://production.example');
    expect(registerWasm).toHaveBeenCalledOnce();
  });

  it.each(['production', 'development'])(
    'preserves the configured %s origin and demo policy',
    async (environment) => {
      const env = {
        ENVIRONMENT: environment,
        APP_BASE_URL: 'https://configured.example',
        DEMO_LOGIN_ENABLED: '',
      } as Env;
      fetchApp.mockResolvedValue(new Response('ok'));
      await onRequest({
        request: new Request('https://request.example/api/health'),
        env,
        waitUntil: vi.fn(),
        passThroughOnException: vi.fn(),
      });
      expect(fetchApp.mock.lastCall?.[1]).toBe(env);
      expect(env.DEMO_LOGIN_ENABLED).toBe('');
    },
  );
});
