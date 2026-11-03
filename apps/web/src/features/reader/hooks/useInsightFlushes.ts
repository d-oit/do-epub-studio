import { useCallback, useEffect } from 'react';

/**
 * Device-local reading insights live in memory until the timer is flushed
 * (unmount or explicit call), so anything that reads them mid-session must
 * flush first. Opening the info panel without this reported "no reading
 * activity" for a session that had been reading and kept the insights export
 * disabled.
 */
export function useOpenInfoPanel(
  flushInsights: () => Promise<void>,
  togglePanel: (panel: 'info') => void,
): () => void {
  return useCallback(() => {
    void flushInsights()
      .catch(() => undefined)
      .finally(() => togglePanel('info'));
  }, [flushInsights, togglePanel]);
}

/**
 * Persists the session's reading insights when the reader unmounts, and pushes
 * them to the API on a best-effort basis.
 */
export function useFlushInsightsOnExit(
  flushInsights: () => Promise<void>,
  syncInsightsToServer: () => Promise<void>,
): void {
  useEffect(
    () => () => {
      void flushInsights().catch(() => {});
      void syncInsightsToServer().catch(() => {});
    },
    [flushInsights, syncInsightsToServer],
  );
}
