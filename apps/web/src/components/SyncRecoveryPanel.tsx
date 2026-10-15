import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuthStore } from '../stores/auth';
import type { SyncQueueItem } from '../lib/offline/db';

// Load offline storage only after the reader opens the recovery UI.
interface SyncRecoveryPanelProps {
  pendingCount: number;
}

export function SyncRecoveryPanel({ pendingCount }: SyncRecoveryPanelProps) {
  const { t } = useTranslation();
  const sessionToken = useAuthStore((state) => state.sessionToken);
  const [isOpen, setIsOpen] = useState(false);
  const [failedItems, setFailedItems] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    if (!sessionToken) {
      setFailedItems([]);
      return;
    }
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const { getSyncQueue } = await import('../lib/offline/db');
      const queue = await getSyncQueue();
      setFailedItems(queue.filter((item) => item.permanentError));
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (isOpen) void refresh();
  }, [isOpen, refresh]);

  const handleRetry = useCallback(
    async (id: string) => {
      try {
        const { retrySyncItem } = await import('../lib/offline/sync');
        await retrySyncItem(id);
        await refresh();
      } catch {
        setLoadFailed(true);
      }
    },
    [refresh],
  );

  const handleExport = useCallback(() => {
    if (failedItems.length === 0) return;
    const data = {
      exportedAt: new Date().toISOString(),
      failedSyncItems: failedItems,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'offline-sync-errors.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [failedItems]);

  if (!sessionToken || pendingCount === 0) return null;

  return (
    <section className="mb-4 rounded-sm border border-border bg-background-secondary px-3 py-2 text-sm text-foreground-muted">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="offline-sync-recovery"
        onClick={() => setIsOpen((open) => !open)}
        className="font-medium text-foreground underline-offset-2 hover:underline"
      >
        {t('offline.pendingSync', { count: pendingCount })}
      </button>
      {isOpen && (
        <div id="offline-sync-recovery" className="mt-3 space-y-3" aria-live="polite">
          <h2 className="font-semibold text-foreground">{t('annotation.syncError')}</h2>
          {loadFailed && <p role="alert">{t('common.error.generic')}</p>}
          {!isLoading && !loadFailed && failedItems.length === 0 && (
            <p>{t('annotation.syncPending')}</p>
          )}
          {failedItems.map((item) => (
            <article key={item.id} className="rounded border border-border bg-background p-3">
              <h3 className="font-medium text-foreground">{item.type}</h3>
              <p className="mt-1 break-words">{item.error}</p>
              <details className="mt-2">
                <summary className="cursor-pointer">{t('reader.details')}</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">
                  {JSON.stringify(item.payload, null, 2)}
                </pre>
              </details>
              <button
                type="button"
                className="mt-3 rounded border border-border px-3 py-1 text-foreground hover:bg-background-secondary"
                onClick={() => void handleRetry(item.id)}
              >
                {t('common.retry')}
              </button>
            </article>
          ))}
          {failedItems.length > 0 && (
            <button
              type="button"
              className="rounded border border-border px-3 py-1 text-foreground hover:bg-background"
              onClick={handleExport}
            >
              {t('reader.exportNotes')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
