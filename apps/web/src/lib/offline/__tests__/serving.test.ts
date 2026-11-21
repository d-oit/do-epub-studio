import { describe, it, expect, beforeEach } from 'vitest';
import { serveBookResource } from '../serving';
import { isBookOfflineReady, getOfflineStorageSummary } from '../offline-state';
import { beginDownload, commitDownload } from '../manifest-store';
import { InMemoryCacheStorage } from './mem-cache';
import { resetIndexedDb } from './reset-idb';

const URL_A = 'https://files.example.test/epub/a';
const HASH = '84d89877f0d4041efb6bf91a16f0248f2fd573e6af05c19f96bedb9f882f7882';
const BODY = '0123456789';

describe('manifest-aware serving (issue #1485)', () => {
  let caches: InMemoryCacheStorage;

  beforeEach(async () => {
    await resetIndexedDb();
    caches = new InMemoryCacheStorage();
  });

  async function completeBook(bookId = 'book-1') {
    const { attemptId, cacheName } = await beginDownload(bookId, 'file-9', BODY.length);
    await commitDownload(
      bookId,
      attemptId,
      [{ url: URL_A, bytes: BODY.length, sha256: HASH }],
      BODY.length,
    );
    const serving = await caches.open(cacheName);
    await serving.put(URL_A, new Response(BODY));
    return { cacheName };
  }

  it('serves a verified offline resource', async () => {
    await completeBook();
    const response = await serveBookResource(new Request(URL_A), { cacheStorage: caches });
    expect(response).toBeDefined();
    expect(await response?.text()).toBe(BODY);
  });

  it('returns undefined for a URL not covered by any complete manifest', async () => {
    await completeBook();
    const response = await serveBookResource(new Request('https://files.example.test/epub/other'), {
      cacheStorage: caches,
    });
    expect(response).toBeUndefined();
  });

  it('returns undefined when the manifest is only staging', async () => {
    await beginDownload('book-2', 'file-9', 10);
    const response = await serveBookResource(new Request(URL_A), { cacheStorage: caches });
    expect(response).toBeUndefined();
  });

  it('serves a partial response for a Range request', async () => {
    await completeBook();
    const request = new Request(URL_A, { headers: { Range: 'bytes=2-5' } });
    const response = await serveBookResource(request, { cacheStorage: caches });
    expect(response?.status).toBe(206);
    expect(await response?.text()).toBe('2345');
    expect(response?.headers.get('Content-Range')).toBe(`bytes 2-5/${BODY.length}`);
  });

  it('isBookOfflineReady is false when a resource is missing from the cache', async () => {
    const { attemptId } = await beginDownload('book-x', 'file-9', 10);
    await commitDownload('book-x', attemptId, [{ url: URL_A, bytes: 10, sha256: HASH }], 10);
    // No serving cache written.
    await expect(isBookOfflineReady('book-x', { cacheStorage: caches })).resolves.toBe(false);
  });

  it('getOfflineStorageSummary counts only fully verified books', async () => {
    await completeBook('book-1');
    const { attemptId } = await beginDownload('book-2', 'file-9', 10);
    await commitDownload('book-2', attemptId, [{ url: URL_A, bytes: 10, sha256: HASH }], 10);

    const summary = await getOfflineStorageSummary({ cacheStorage: caches });
    expect(summary.bookCount).toBe(2);
    expect(summary.readyCount).toBe(1);
    expect(summary.totalBytes).toBe(BODY.length);
  });
});
