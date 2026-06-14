import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSignedUrl, _resetHeadCacheForTests } from '../storage/signed-url';
import type { Env } from '../lib/env';

interface FakeR2Head {
  calls: number;
  result: R2Object | null;
  throw?: boolean;
}

function makeEnv(head: FakeR2Head): Env {
    return {
      BOOKS_BUCKET: {
        head: vi.fn().mockImplementation(() => {
          head.calls += 1;
          if (head.throw) return Promise.reject(new Error('r2-down'));
          return Promise.resolve(head.result);
        }),
      },
    } as unknown as Env;
}

const SIGNING_SECRET = 'a'.repeat(64);

describe('generateSignedUrl', () => {
  beforeEach(() => {
    _resetHeadCacheForTests();
  });

  it('returns R2 head metadata when present', async () => {
    const head: FakeR2Head = {
      calls: 0,
      result: {
        size: 12345,
        httpMetadata: { contentType: 'application/pdf' },
      } as unknown as R2Object,
    };
    const env = makeEnv(head);
    env.SESSION_SIGNING_SECRET = SIGNING_SECRET;
    const res = await generateSignedUrl(env, 'book-1', 'file.pdf');
    expect(res.fileSize).toBe(12345);
    expect(res.mimeType).toBe('application/pdf');
    expect(head.calls).toBe(1);
  });

  it('falls back to defaults when R2 head throws', async () => {
    const head: FakeR2Head = { calls: 0, result: null, throw: true };
    const env = makeEnv(head);
    env.SESSION_SIGNING_SECRET = SIGNING_SECRET;
    const res = await generateSignedUrl(env, 'book-1', 'file.epub');
    expect(res.fileSize).toBe(0);
    expect(res.mimeType).toBe('application/epub+zip');
  });

  it('caches the head result so the second call does not re-fetch', async () => {
    const head: FakeR2Head = {
      calls: 0,
      result: {
        size: 4242,
        httpMetadata: { contentType: 'image/png' },
      } as unknown as R2Object,
    };
    const env = makeEnv(head);
    env.SESSION_SIGNING_SECRET = SIGNING_SECRET;
    const r1 = await generateSignedUrl(env, 'book-2', 'cover.png');
    const r2 = await generateSignedUrl(env, 'book-2', 'cover.png');
    expect(r1.fileSize).toBe(4242);
    expect(r2.mimeType).toBe('image/png');
    expect(head.calls).toBe(1);
  });

  it('returns a valid signed URL with expires + signature params', async () => {
    const head: FakeR2Head = { calls: 0, result: null };
    const env = makeEnv(head);
    env.SESSION_SIGNING_SECRET = SIGNING_SECRET;
    env.APP_BASE_URL = 'https://example.com';
    const res = await generateSignedUrl(env, 'book-3', 'chapter.xhtml');
    expect(res.url).toContain('/api/files/book-3/chapter.xhtml');
    expect(res.url).toMatch(/expires=\d+/);
    expect(res.url).toMatch(/signature=[0-9a-f]{64}/);
  });
});
