import { useEffect } from 'react';
import { recoverOfflineStorage } from '../lib/offline/recovery';

let recoveryStarted = false;

/**
 * Reconcile offline storage once per document load: interrupted staging,
 * orphan caches, stale/corrupt manifests. The service worker also runs the
 * same routine on activation; this covers app starts where the SW is not
 * (yet) controlling the page. Idempotent and best-effort.
 */
export function useOfflineRecovery(): void {
  useEffect(() => {
    if (recoveryStarted) return;
    recoveryStarted = true;
    void recoverOfflineStorage().catch(() => {
      // Recovery must never interfere with app boot.
    });
  }, []);
}
