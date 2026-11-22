import { useEffect } from 'react';

let recoveryStarted = false;

/**
 * Reconcile offline storage once per document load: interrupted staging,
 * orphan caches, stale/corrupt manifests. The service worker also runs the
 * same routine on activation; this covers app starts where the SW is not
 * (yet) controlling the page.
 *
 * `lib/offline/recovery` is loaded via a dynamic import: the recovery module
 * shares schema code with the reader route, so importing it statically from
 * the app shell would drag the reader-route chunk into every page's bundle.
 * Keeping it lazy preserves route-level code splitting (ADR-107). Idempotent
 * and best-effort.
 */
export function useOfflineRecovery(): void {
  useEffect(() => {
    if (recoveryStarted) return;
    recoveryStarted = true;
    void import('../lib/offline/recovery')
      .then(({ recoverOfflineStorage }) => recoverOfflineStorage())
      .catch(() => {
        // Recovery must never interfere with app boot.
      });
  }, []);
}
