import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { useReaderStore } from '../stores/reader';

/**
 * Shell-level sync visibility: mirrors connectivity and the pending sync
 * queue into `useReaderStore` so every route (catalog, library, settings —
 * not just the reader) can render offline/pending state.
 *
 * Queue payloads are encrypted with the session token, so polling while
 * logged out would read another owner's data path; the hook resets the count
 * and skips IndexedDB entirely until a session exists. The effect re-runs on
 * the auth flip, so the count is refreshed on login and cleared on logout.
 */
export function useSyncStatus(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setOffline = useReaderStore((s) => s.setOffline);
  const setPendingSyncCount = useReaderStore((s) => s.setPendingSyncCount);

  useEffect(() => {
    if (!isAuthenticated) {
      setPendingSyncCount(0);
      return;
    }

    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setOffline(!navigator.onLine);

    // Dynamically imported so the IndexedDB/sync machinery stays out of the
    // initial bundle: a static barrel import would join every route's total
    // (ADR-107 §3). Polling starts once the chunk loads; no UX impact.
    let cancelled = false;
    let cleanupOnline: (() => void) | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    void import('../lib/offline')
      .then(({ getSyncQueue, setupOnlineListener }) => {
        if (cancelled) return;
        cleanupOnline = setupOnlineListener();
        const updateCount = async () => {
          try {
            const queue = await getSyncQueue();
            if (!cancelled) setPendingSyncCount(queue.length);
          } catch {
            /* IndexedDB may be unavailable (private mode, blocked storage). */
          }
        };
        void updateCount();
        interval = setInterval(() => void updateCount(), 5000);
      })
      .catch(() => {
        /* Offline stack unloadable — connectivity listeners above still apply. */
      });

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupOnline?.();
    };
  }, [isAuthenticated, setOffline, setPendingSyncCount]);
}
