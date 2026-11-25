import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { ConfirmDialog } from './ui';
import { formatBytes } from '../lib/formatBytes';
import {
  getPersistentStorageStatus,
  requestPersistentStorage,
} from '../lib/offline/storage-policy';
import { getOfflineStorageSummary } from '../lib/offline/offline-state';

interface StorageEstimate {
  usage: number;
  quota: number;
}

interface PersistentStatus {
  supported: boolean;
  persisted: boolean;
  denied: boolean;
}

interface OfflineSummary {
  bookCount: number;
  readyCount: number;
  totalBytes: number;
}

const EMPTY_SUMMARY: OfflineSummary = { bookCount: 0, readyCount: 0, totalBytes: 0 };

/**
 * Storage quota panel using the Storage API (issue #1485).
 * Shows usage/quota with a progress bar, persistent-storage status, an offline
 * book summary, and a "clear cache" action.
 */
export function StorageQuota() {
  const { t } = useTranslation();
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [persistStatus, setPersistStatus] = useState<PersistentStatus>({
    supported: false,
    persisted: false,
    denied: false,
  });
  const [isRequestingPersist, setIsRequestingPersist] = useState(false);
  const [summary, setSummary] = useState<OfflineSummary>(EMPTY_SUMMARY);

  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        setEstimate({ usage: est.usage ?? 0, quota: est.quota ?? 0 });
      } else {
        setError(t('storage.unsupported'));
      }
    } catch {
      setError(t('storage.unsupported'));
    }

    const [persist, offline] = await Promise.all([
      getPersistentStorageStatus(),
      getOfflineStorageSummary(),
    ]);
    setPersistStatus(persist);
    setSummary(offline);
    setIsLoading(false);
  }, [t]);

  useEffect(() => {
    void refresh();
    return () => {
      clearTimeout(clearTimerRef.current);
    };
  }, [refresh]);

  const requestPersist = useCallback(async () => {
    setIsRequestingPersist(true);
    try {
      const status = await requestPersistentStorage();
      setPersistStatus(status);
    } finally {
      setIsRequestingPersist(false);
    }
  }, []);

  const executeClear = useCallback(async () => {
    setIsClearing(true);
    setError(null);
    setCleared(false);
    try {
      // Clear all Cache Storage entries (includes verified offline books;
      // recovery will reconcile manifests on next start).
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // Clear all IndexedDB databases (except the auth store)
      if (indexedDB.databases) {
        const dbs = await indexedDB.databases();
        await Promise.all(
          dbs
            .filter((db) => db.name && db.name !== 'do-epub-auth')
            .map((db) => {
              const dbName = db.name;
              if (!dbName) {
                return Promise.resolve();
              }
              const { promise, resolve } = Promise.withResolvers<void>();
              const req = indexedDB.deleteDatabase(dbName);
              req.onsuccess = () => {
                resolve();
              };
              req.onerror = () => {
                resolve();
              };
              return promise;
            }),
        );
      }
      setCleared(true);
      // Auto-dismiss the cleared message after 3 seconds
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setCleared(false);
      }, 3000);
      // Refresh estimate after clearing
      await refresh();
    } catch {
      setError(t('storage.clearError'));
    } finally {
      setIsClearing(false);
    }
  }, [refresh, t]);

  const handleClearClick = useCallback(() => {
    setShowConfirm(true);
  }, []);
  const handleConfirmClear = useCallback(() => {
    setShowConfirm(false);
    void executeClear();
  }, [executeClear]);

  const usagePercent =
    estimate && estimate.quota > 0 ? Math.min(100, (estimate.usage / estimate.quota) * 100) : 0;
  const isHighUsage = usagePercent > 80;

  if (isLoading) {
    return (
      <div className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3 rounded skeleton" />
          <div className="h-8 w-full rounded skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-secondary rounded-xl border border-border p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">{t('storage.title')}</h3>
        <svg
          className="w-5 h-5 text-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2zm0 0V5a2 2 0 012-2h12a2 2 0 012 2v2"
          />
        </svg>
      </div>

      {error ? (
        <p className="text-sm text-foreground-muted">{error}</p>
      ) : estimate ? (
        <>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-foreground-muted">
              {t('storage.used')}:{' '}
              <span className="font-medium text-foreground">{formatBytes(estimate.usage)}</span>
            </span>
            <span className="text-foreground-muted">
              {t('storage.available')}:{' '}
              <span className="font-medium text-foreground">{formatBytes(estimate.quota)}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="w-full h-3 rounded-full bg-background-tertiary overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(usagePercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('storage.usageLabel')}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHighUsage ? 'bg-semantic-warning' : 'bg-accent'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          {isHighUsage && (
            <p className="mt-2 text-xs text-semantic-warning flex items-center gap-1.5">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {t('storage.highUsage')}
            </p>
          )}

          {/* Persistent storage status */}
          <div className="mt-4 rounded-lg border border-border bg-background p-3 text-xs text-foreground-muted">
            {persistStatus.persisted ? (
              <p className="flex items-center gap-1.5 text-semantic-success">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {t('storage.persistence.persisted')}
              </p>
            ) : persistStatus.denied ? (
              <p className="text-semantic-warning">{t('storage.persistence.denied')}</p>
            ) : !persistStatus.supported ? (
              <p>{t('storage.persistence.unsupported')}</p>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p>{t('storage.persistence.requested')}</p>
                <button
                  type="button"
                  onClick={() => void requestPersist()}
                  disabled={isRequestingPersist}
                  className="shrink-0 rounded-md border border-border px-2.5 py-1 font-medium text-foreground hover:bg-background-tertiary disabled:opacity-50"
                >
                  {isRequestingPersist
                    ? t('storage.persistence.requesting')
                    : t('storage.persistence.requestButton')}
                </button>
              </div>
            )}
          </div>

          {/* Offline book summary */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-muted">
            {summary.bookCount > 0 ? (
              <>
                <span>{t('storage.offlineBooks', { books: String(summary.bookCount) })}</span>
                <span>{t('storage.offlineBytes', { bytes: formatBytes(summary.totalBytes) })}</span>
              </>
            ) : (
              <span>{t('storage.offlineEmpty')}</span>
            )}
          </div>

          {cleared && (
            <p className="mt-3 text-xs text-semantic-success flex items-center gap-1.5">
              <svg
                className="w-4 h-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {t('storage.cleared')}
            </p>
          )}

          <button
            type="button"
            onClick={handleClearClick}
            disabled={isClearing || estimate.usage === 0}
            className="mt-4 w-full px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background text-foreground hover:bg-background-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-accent outline-none"
          >
            {isClearing ? t('storage.clearing') : t('storage.clearButton')}
          </button>

          <ConfirmDialog
            isOpen={showConfirm}
            title={t('storage.clearButton')}
            description={t('storage.confirmClear')}
            variant="danger"
            confirmLabel={t('storage.clearButton')}
            cancelLabel={t('annotation.cancel')}
            onConfirm={handleConfirmClear}
            onCancel={() => {
              setShowConfirm(false);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
