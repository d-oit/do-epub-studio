import { useEffect, useRef, useCallback, useState } from 'react';
import { useSwUpdateStore } from '../stores/sw-update';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui';

export function SwUpdateNotification() {
  const { t } = useTranslation();
  const needRefresh = useSwUpdateStore((s) => s.needRefresh);
  const offlineReady = useSwUpdateStore((s) => s.offlineReady);
  const updateServiceWorker = useSwUpdateStore((s) => s.updateServiceWorker);
  const dismiss = useSwUpdateStore((s) => s.dismiss);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleUpdate = useCallback(() => {
    updateServiceWorker?.();
    dismiss();
  }, [updateServiceWorker, dismiss]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsExiting(true);
  }, []);

  // Auto-dismiss offline-ready after 6 seconds
  useEffect(() => {
    if (offlineReady && !needRefresh) {
      timerRef.current = setTimeout(() => {
        setIsExiting(true);
      }, 6000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    return undefined;
  }, [offlineReady, needRefresh]);

  const show = needRefresh || offlineReady;

  useEffect(() => {
    if (show && !isExiting) {
      setShouldRender(true);
    } else if (!show || isExiting) {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [show, isExiting]);

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
        dismiss();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isExiting, dismiss]);

  const icon = needRefresh ? (
    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ) : (
    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] w-full max-w-[calc(100vw-2rem)] sm:max-w-md pointer-events-auto ${isExiting ? 'animate-slide-out-bottom' : 'animate-slide-in-bottom'}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-background-secondary text-foreground border border-border shadow-lg">
        {icon}
        <p className="flex-1 text-sm text-foreground">
          {needRefresh ? t('sw.updateAvailable') : t('sw.offlineReady')}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {needRefresh && (
            <Button variant="secondary" size="sm" onClick={handleUpdate}>
              {t('sw.updateAction')}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            aria-label={t('sw.dismissAction')}
            className="min-w-[44px] min-h-[44px]"
          >
            {t('sw.dismissAction')}
          </Button>
        </div>
      </div>
    </div>
  );
}
