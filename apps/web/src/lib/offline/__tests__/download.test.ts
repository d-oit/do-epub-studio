import { describe, it, expect, beforeEach } from 'vitest';
import { downloadBookForOffline } from '../download';
import { beginDownload, getManifest } from '../manifest-store';
import { isBookOfflineReady } from '../offline-state';
import { InMemoryCacheStorage } from './mem-cache';
import { resetIndexedDb } from './reset-idb';

const BODY = new TextEncoder().encode('epub-bytes-0123456789').buffer;
const URL = 'https://files.example.test/epub/abc123';
const FILE_ID = 'file-abc123';

function makeFetch(response: Response, opt: { throwOnce?: Error } = {}) {
  let thrown = false;
  return () => {
    if (opt.throwOnce && !thrown) {
      thrown = true;
      throw opt.throwOnce;
    }
    return Promise.resolve(response.clone());
  };
}

describe('offline download engine (issue #1485)', () => {
  let caches: InMemoryCacheStorage;

  beforeEach(async () => {
    await resetIndexedDb();
    caches = new InMemoryCacheStorage();
  });

  function opts(
    overrides: Partial<{
      bookId: string;
      resolveFileUrl: () => Promise<{ url: string; fileId?: string; fileSize?: number }>;
      fetchImpl: typeof fetch;
      cacheStorage: InMemoryCacheStorage;
      signal?: AbortSignal;
      onProgress?: (received: number, total: number) => void;
    }> = {},
  ) {
    return {
      bookId: 'book-1',
      resolveFileUrl: () =>
        Promise.resolve({ url: URL, fileId: FILE_ID, fileSize: BODY.byteLength }),
      fetchImpl: makeFetch(new Response(BODY)),
      cacheStorage: caches,
      ...overrides,
    };
  }

  it('downloads, verifies, and commits a complete manifest with a serving cache', async () => {
    const manifest = await downloadBookForOffline(opts());

    expect(manifest.state).toBe('complete');
    expect(manifest.packageVersion).toBe(FILE_ID);
    expect(manifest.totalBytes).toBe(BODY.byteLength);
    expect(manifest.resources).toHaveLength(1);
    expect(manifest.resources[0]?.url).toBe(URL);
    expect(manifest.resources[0]?.bytes).toBe(BODY.byteLength);
    expect(manifest.resources[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);

    // Staging cache deleted; serving cache holds the verified copy.
    await expect(caches.keys()).resolves.not.toContain(manifest.stagingCacheName);
    const finalCache = caches.get(manifest.cacheName);
    expect(finalCache?.has(URL)).toBe(true);

    await expect(isBookOfflineReady('book-1', { cacheStorage: caches })).resolves.toBe(true);
  });

  it('rolls back atomically when the fetch stage hits a quota error', async () => {
    const quota = new DOMException('quota', 'QuotaExceededError');
    await expect(
      downloadBookForOffline(
        opts({ fetchImpl: makeFetch(new Response(BODY), { throwOnce: quota }) }),
      ),
    ).rejects.toMatchObject({ code: 'quota' });

    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('quota');
    expect(manifest?.resources).toEqual([]);
    expect(manifest?.totalBytes).toBe(0);
    await expect(caches.keys()).resolves.toEqual([]);
    await expect(isBookOfflineReady('book-1', { cacheStorage: caches })).resolves.toBe(false);
  });

  it('rolls back atomically when the staging cache write hits a quota error', async () => {
    const original = caches.open.bind(caches);
    caches.open = async (name: string) => {
      const cache = await original(name);
      if (name.startsWith('dl-staging/')) {
        cache.put = () => Promise.reject(new DOMException('quota', 'QuotaExceededError'));
      }
      return cache;
    };

    await expect(downloadBookForOffline(opts())).rejects.toMatchObject({ code: 'quota' });
    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('quota');
    await expect(caches.keys()).resolves.toEqual([]);
  });

  it('fails with integrity error when the server size contradicts the body', async () => {
    await expect(
      downloadBookForOffline(
        opts({
          resolveFileUrl: () => Promise.resolve({ url: URL, fileId: FILE_ID, fileSize: 99999 }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'integrity' });

    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('integrity');
    await expect(caches.keys()).resolves.toEqual([]);
  });

  it('fails with integrity error when the staged copy is corrupted', async () => {
    const original = caches.open.bind(caches);
    caches.open = async (name: string) => {
      const cache = await original(name);
      if (name.startsWith('dl-staging/')) {
        cache.corruptOnPut();
      }
      return cache;
    };

    await expect(downloadBookForOffline(opts())).rejects.toMatchObject({ code: 'integrity' });
    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('integrity');
    await expect(caches.keys()).resolves.toEqual([]);
  });

  it('never commits a stale attempt when superseded mid-download (race)', async () => {
    const race = downloadBookForOffline(opts());

    // Wait (via microtask yields, no wall-clock timers) until the engine's
    // own attempt is visible, then supersede it with a newer attempt.
    for (let i = 0; i < 1000; i += 1) {
      const started = await getManifest('book-1');
      if (started?.state === 'staging' && started.packageVersion === FILE_ID) break;
      await Promise.resolve();
    }
    await beginDownload('book-1', 'file-new', 0);

    await expect(race).rejects.toMatchObject({ code: 'race' });
    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('staging');
    expect(manifest?.packageVersion).toBe('file-new');
  });

  it('fails with network error on non-ok response and rolls back', async () => {
    await expect(
      downloadBookForOffline(
        opts({ fetchImpl: () => Promise.resolve(new Response('nope', { status: 503 })) }),
      ),
    ).rejects.toMatchObject({ code: 'network' });
    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('network');
    await expect(caches.keys()).resolves.toEqual([]);
  });

  it('maps 401 from file-url resolution to unauthorized error', async () => {
    const unauthorized = Object.assign(new Error('Forbidden'), { status: 403 });
    await expect(
      downloadBookForOffline(
        opts({
          resolveFileUrl: () => {
            throw unauthorized;
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'unauthorized' });
    expect(await getManifest('book-1')).toBeUndefined();
    await expect(caches.keys()).resolves.toEqual([]);
  });
});
