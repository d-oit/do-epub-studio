import { describe, it, expect, beforeEach } from 'vitest';
import { recoverOfflineStorage } from '../recovery';
import { beginDownload, commitDownload, getManifest } from '../manifest-store';
import { InMemoryCacheStorage } from './mem-cache';
import { resetIndexedDb } from './reset-idb';

const URL_A = 'https://files.example.test/epub/a';
const URL_B = 'https://files.example.test/epub/b';
const HASH = '84d89877f0d4041efb6bf91a16f0248f2fd573e6af05c19f96bedb9f882f7882';

describe('offline storage recovery (issue #1485)', () => {
  let caches: InMemoryCacheStorage;

  beforeEach(async () => {
    await resetIndexedDb();
    caches = new InMemoryCacheStorage();
  });

  it('marks interrupted staging downloads failed and removes their staging caches', async () => {
    const { stagingCacheName } = await beginDownload('book-1', 'file-9', 100);
    const staging = await caches.open(stagingCacheName);
    await staging.put(URL_A, new Response('partial'));

    const report = await recoverOfflineStorage({ cacheStorage: caches });

    const manifest = await getManifest('book-1');
    expect(manifest?.state).toBe('failed');
    expect(manifest?.failure?.code).toBe('interrupted');
    expect(report.stagingMarkedFailed).toContain('book-1');
    expect(await caches.keys()).not.toContain(stagingCacheName);
  });

  it('removes orphan staging caches with no referencing manifest', async () => {
    const orphan = await caches.open('dl-staging/book-orphan/some-attempt');
    await orphan.put(URL_A, new Response('x'));

    const report = await recoverOfflineStorage({ cacheStorage: caches });

    expect(report.orphanStagingRemoved).toContain('dl-staging/book-orphan/some-attempt');
    expect(await caches.keys()).toEqual([]);
  });

  it('quarantines a complete manifest whose verified resource is missing', async () => {
    const { attemptId, cacheName } = await beginDownload('book-1', 'file-9', 10);
    await commitDownload('book-1', attemptId, [{ url: URL_A, bytes: 10, sha256: HASH }], 10);
    // No cache contents were written: the resource is missing.

    const report = await recoverOfflineStorage({ cacheStorage: caches });

    expect(report.quarantinedBooks).toContain('book-1');
    expect(await getManifest('book-1')).toBeUndefined();
    expect(await caches.keys()).not.toContain(cacheName);
  });

  it('quarantines a complete manifest whose verified resource is corrupt', async () => {
    const { attemptId, cacheName } = await beginDownload('book-1', 'file-9', 10);
    await commitDownload('book-1', attemptId, [{ url: URL_A, bytes: 10, sha256: HASH }], 10);
    const serving = await caches.open(cacheName);
    await serving.put(URL_A, new Response('not-the-hash'));

    const report = await recoverOfflineStorage({ cacheStorage: caches });

    expect(report.quarantinedBooks).toContain('book-1');
    expect(await getManifest('book-1')).toBeUndefined();
    expect(await caches.keys()).not.toContain(cacheName);
  });

  it('keeps a complete manifest whose resources verify, and cleans leftover staging', async () => {
    const { attemptId, cacheName, stagingCacheName } = await beginDownload('book-1', 'file-9', 10);
    await commitDownload('book-1', attemptId, [{ url: URL_A, bytes: 10, sha256: HASH }], 10);
    const serving = await caches.open(cacheName);
    await serving.put(URL_A, new Response('0123456789'));
    const staging = await caches.open(stagingCacheName);
    await staging.put(URL_B, new Response('leftover'));

    const report = await recoverOfflineStorage({ cacheStorage: caches });

    expect(report.quarantinedBooks).toEqual([]);
    expect(await getManifest('book-1')).toMatchObject({ state: 'complete' });
    expect(await caches.keys()).not.toContain(stagingCacheName);
    expect(report.repairedStagingRefs).toContain('book-1');
    expect((await getManifest('book-1'))?.stagingCacheName).toBeNull();
  });

  it('removes orphan serving caches whose manifests are gone (invalid rows/corrupt)', async () => {
    const orphan = await caches.open('dl/book-orphan');
    await orphan.put(URL_A, new Response('x'));

    const report = await recoverOfflineStorage({ cacheStorage: caches });

    expect(report.orphanBookCachesRemoved).toContain('dl/book-orphan');
    expect(await caches.keys()).toEqual([]);
  });
});
