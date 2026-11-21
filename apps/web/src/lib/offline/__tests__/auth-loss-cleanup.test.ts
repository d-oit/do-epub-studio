import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearAllEncryptedData, saveProgress, getProgress } from '../db';
import { beginDownload, commitDownload, getManifest } from '../manifest-store';
import { InMemoryCacheStorage } from './mem-cache';
import { resetIndexedDb } from './reset-idb';
import { useAuthStore } from '@/stores/auth';

const URL = 'https://files.example.test/epub/a';
const HASH = 'a'.repeat(64);

describe('auth-loss cleanup (issue #1485)', () => {
  let caches: InMemoryCacheStorage;
  let originalCaches: unknown;

  beforeEach(async () => {
    await resetIndexedDb();
    useAuthStore.setState({ sessionToken: 'test-token' });
    caches = new InMemoryCacheStorage();
    originalCaches = (globalThis as { caches?: unknown }).caches;
    Object.defineProperty(globalThis, 'caches', {
      value: caches,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    });
    useAuthStore.setState({ sessionToken: null });
  });

  it('clears user data AND downloaded book packages on logout', async () => {
    await saveProgress({
      id: 'p1',
      bookId: 'b1',
      cfi: 'epubcfi(/6/1)',
      percentage: 50,
      lastRead: 1,
      synced: false,
      mutationId: 'm1',
    });

    const { attemptId, cacheName } = await beginDownload('book-1', 'file-9', 10);
    await commitDownload('book-1', attemptId, [{ url: URL, bytes: 10, sha256: HASH }], 10);
    const serving = await caches.open(cacheName);
    await serving.put(URL, new Response('0123456789'));

    await clearAllEncryptedData();

    expect(await getProgress('b1')).toBeUndefined();
    expect(await getManifest('book-1')).toBeUndefined();
    expect(await caches.keys()).toEqual([]);
  });
});
