import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';
import { downloadBookForOffline, OfflineDownloadError } from '../../../lib/offline/download';
import { getCacheStorage } from '../../../lib/offline/cache';
import { getManifest, removeManifest } from '../../../lib/offline/manifest-store';
import { isBookOfflineReady } from '../../../lib/offline/offline-state';

/**
 * Per-book offline download state (issue #1485).
 *
 * The UI may only claim a book is available offline when `isBookOfflineReady`
 * returns true (complete + verified manifest with every resource present):
 * `ready` below is derived from that check, never from the manifest alone.
 */

export type OfflineBookStatus =
  | { kind: 'not-downloaded' }
  | { kind: 'downloading'; percent: number | null }
  | { kind: 'ready' }
  | { kind: 'failed'; message?: string };

export function useOfflineBook(bookId: string | undefined) {
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [status, setStatus] = useState<OfflineBookStatus>({ kind: 'not-downloaded' });
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!bookId || !mountedRef.current) return;
    const manifest = await getManifest(bookId);
    if (manifest && manifest.state === 'complete') {
      const ready = await isBookOfflineReady(bookId);
      if (mountedRef.current) {
        setStatus(ready ? { kind: 'ready' } : { kind: 'failed', message: 'corrupt' });
      }
      return;
    }
    if (manifest && manifest.state === 'staging') {
      if (mountedRef.current) setStatus({ kind: 'downloading', percent: null });
      return;
    }
    if (manifest && manifest.state === 'failed') {
      if (mountedRef.current) {
        setStatus({ kind: 'failed', message: manifest.failure?.message });
      }
      return;
    }
    if (mountedRef.current) setStatus({ kind: 'not-downloaded' });
  }, [bookId]);

  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  const download = useCallback(async () => {
    if (!bookId || !sessionToken || busy) return;
    setBusy(true);
    setStatus({ kind: 'downloading', percent: null });
    try {
      await downloadBookForOffline({
        bookId,
        resolveFileUrl: async () => {
          const data = await apiRequest<{ url: string; fileId?: string; fileSize?: number }>(
            `/api/books/${bookId}/file-url`,
            {
              method: 'POST',
              token: sessionToken,
              body: JSON.stringify({}),
            },
          );
          return { url: data.url, fileId: data.fileId, fileSize: data.fileSize };
        },
        onProgress: (received, total) => {
          if (mountedRef.current && total > 0) {
            setStatus({ kind: 'downloading', percent: Math.round((received / total) * 100) });
          }
        },
      });
      await refresh();
    } catch (error) {
      const message =
        error instanceof OfflineDownloadError ? error.message : undefined;
      if (mountedRef.current) {
        setStatus({ kind: 'failed', message });
      }
      await refresh();
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [bookId, sessionToken, busy, refresh]);

  const remove = useCallback(async () => {
    if (!bookId || busy) return;
    setBusy(true);
    try {
      const manifest = await getManifest(bookId);
      const cacheStorage = getCacheStorage();
      if (manifest && cacheStorage) {
        await cacheStorage.delete(manifest.cacheName);
        if (manifest.stagingCacheName) {
          await cacheStorage.delete(manifest.stagingCacheName);
        }
      }
      if (manifest) {
        await removeManifest(bookId);
      }
      if (mountedRef.current) setStatus({ kind: 'not-downloaded' });
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [bookId, busy]);

  return { status, busy, download, remove, refresh };
}
