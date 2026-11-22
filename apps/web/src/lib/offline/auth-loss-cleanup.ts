import { clearAllEncryptedData } from './db';

/**
 * Invoked on auth loss (manual or expired 401). Isolated in a standalone
 * module so `lib/api/core.ts` dynamic import never references `lib/offline/db.ts`
 * or `idb` statically or at build time from the app shell.
 *
 * Besides user data, downloaded book packages (serving/staging caches +
 * manifests) are removed so a signed-out device does not retain a granted
 * book's content (issue #1485). The manifest/cache layer is imported lazily
 * inside the run so this module stays small at load time.
 */
export async function clearEncryptedDataOnAuthLoss(): Promise<void> {
  await clearAllEncryptedData();

  const [{ listManifests, removeManifest }, { getCacheStorage }] = await Promise.all([
    import('./manifest-store'),
    import('./cache'),
  ]);
  const cacheStorage = getCacheStorage();
  const manifests = await listManifests();
  for (const manifest of manifests) {
    if (cacheStorage) {
      try {
        await cacheStorage.delete(manifest.cacheName);
      } catch {
        // In use; recovery will remove leftovers on next start.
      }
      if (manifest.stagingCacheName) {
        try {
          await cacheStorage.delete(manifest.stagingCacheName);
        } catch {
          // Best-effort.
        }
      }
    }
    await removeManifest(manifest.bookId);
  }
}
