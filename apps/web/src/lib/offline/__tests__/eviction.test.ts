import { describe, it, expect, beforeEach } from 'vitest';
import { openOfflineDb } from '../idb-schema';
import { evictToThreshold, prepareSpaceFor } from '../eviction';
import { beginDownload, commitDownload, getManifest, removeManifest } from '../manifest-store';
import { saveProgress } from '../db';
import { useAuthStore } from '@/stores/auth';
import { InMemoryCacheStorage } from './mem-cache';
import { resetIndexedDb } from './reset-idb';

const SIGNED_URL = 'https://files.example.test/epub/a';
const HASH = 'a'.repeat(64);
const MB = 1024 * 1024;

async function makeCompleteBook(bookId: string, bytes: number, lastAccess: number) {
  const { attemptId } = await beginDownload(bookId, 'file-1', bytes);
  await commitDownload(
    bookId,
    attemptId,
    [{ url: `${SIGNED_URL}/${bookId}`, bytes, sha256: HASH }],
    bytes,
  );
  const manifest = await getManifest(bookId);
  if (!manifest) throw new Error('manifest missing');
  await removeManifest(bookId);
  // Re-insert with the desired lastAccess (LRU clock).
  const opened = await openOfflineDb();
  await opened.put('downloadManifests', { ...manifest, lastAccess });
  opened.close();
}

/** Simulated usage that shrinks when eviction deletes a sized cache. */
function makeUsage(initialUsage: number, quota: number, cacheSizes: Record<string, number>) {
  let simUsage = initialUsage;
  return {
    estimate: () => Promise.resolve({ usage: simUsage, quota }),
    accountFor(name: string, deleted: boolean) {
      const size = cacheSizes[name];
      if (deleted && size !== undefined) {
        simUsage = Math.max(0, simUsage - size);
      }
    },
    current: () => simUsage,
  };
}

describe('storage eviction (issue #1485)', () => {
  let caches: InMemoryCacheStorage;
  let usage: ReturnType<typeof makeUsage>;

  beforeEach(async () => {
    await resetIndexedDb();
    useAuthStore.setState({ sessionToken: 'test-token' });
    caches = new InMemoryCacheStorage();
    const originalDelete = caches.delete.bind(caches);
    caches.delete = async (name: string) => {
      const deleted = await originalDelete(name);
      usage.accountFor(name, deleted);
      return deleted;
    };
  });

  it('evicts transient and derived caches on quota pressure, never user data', async () => {
    await caches.open('images');
    await caches.open('external-assets');
    await caches.open('api-responses');
    await caches.open('workbox-precache-something');
    usage = makeUsage(90 * MB, 100 * MB, { images: 5 * MB });

    await saveProgress({
      id: 'p1',
      bookId: 'b1',
      cfi: 'epubcfi(/6/1)',
      percentage: 50,
      lastRead: 1,
      synced: false,
      mutationId: 'm1',
    });

    const result = await evictToThreshold({ cacheStorage: caches, estimate: usage.estimate });

    expect(result.removedCaches).toContain('images');
    expect(result.removedCaches).toContain('external-assets');
    expect(result.removedCaches).toContain('api-responses');
    expect(result.removedCaches).not.toContain('workbox-precache-something');
    expect(await caches.keys()).toEqual(['workbox-precache-something']);
    // Progress survives.
    const { getProgress } = await import('../db');
    expect(await getProgress('b1')).toMatchObject({ id: 'p1' });
  });

  it('marks staging downloads failed when their staging cache is evicted', async () => {
    const { stagingCacheName, attemptId } = await beginDownload('book-staging', 'file-1', 100);
    const staging = await caches.open(stagingCacheName);
    await staging.put(`${SIGNED_URL}/staging`, new Response('partial'));
    usage = makeUsage(95 * MB, 100 * MB, {});

    await evictToThreshold({ cacheStorage: caches, estimate: usage.estimate });

    const manifest = await getManifest('book-staging');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('evicted');
    expect(manifest?.attemptId).toBe(attemptId);
    expect(await caches.keys()).not.toContain(stagingCacheName);
  });

  it('evicts complete books in LRU order after cheaper tiers are exhausted', async () => {
    await makeCompleteBook('book-old', 20 * MB, 1000);
    await makeCompleteBook('book-new', 20 * MB, 2000);
    const oldCache = await caches.open('dl/book-old');
    await oldCache.put(`${SIGNED_URL}/book-old`, new Response('old-book-content'));
    const newCache = await caches.open('dl/book-new');
    await newCache.put(`${SIGNED_URL}/book-new`, new Response('new-book-content'));
    usage = makeUsage(90 * MB, 100 * MB, {
      'dl/book-old': 20 * MB,
      'dl/book-new': 20 * MB,
    });

    const result = await evictToThreshold({ cacheStorage: caches, estimate: usage.estimate });

    expect(result.evictedBooks).toContain('book-old');
    expect(result.evictedBooks).not.toContain('book-new');
    expect(await getManifest('book-old')).toBeUndefined();
    expect(await caches.keys()).not.toContain('dl/book-old');
    expect(await caches.keys()).toContain('dl/book-new');
  });

  it('prepareSpaceFor evicts before a write when projected usage exceeds the threshold', async () => {
    await makeCompleteBook('book-old', 20 * MB, 1000);
    const oldCache = await caches.open('dl/book-old');
    await oldCache.put(`${SIGNED_URL}/book-old`, new Response('old'));
    usage = makeUsage(80 * MB, 100 * MB, { 'dl/book-old': 20 * MB });

    // Current usage 80MB; adding 20MB would exceed 85% of 100MB.
    const result = await prepareSpaceFor(20 * MB, {
      cacheStorage: caches,
      estimate: usage.estimate,
    });

    expect(result.evictedBooks).toContain('book-old');
  });

  it('leaves storage alone when there is enough headroom', async () => {
    await makeCompleteBook('book-old', 20 * MB, 1000);
    const oldCache = await caches.open('dl/book-old');
    await oldCache.put(`${SIGNED_URL}/book-old`, new Response('old'));
    usage = makeUsage(50 * MB, 100 * MB, { 'dl/book-old': 20 * MB });

    const result = await prepareSpaceFor(2 * MB, {
      cacheStorage: caches,
      estimate: usage.estimate,
    });

    expect(result.evictedBooks).toEqual([]);
    expect(await caches.keys()).toContain('dl/book-old');
  });
});
