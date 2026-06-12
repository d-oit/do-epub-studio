import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

  const handleUpdate = useCallback(() => {
    updateServiceWorker?.();
    dismiss();
  }, [updateServiceWorker, dismiss]);

  const handleDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dismiss();
  }, [dismiss]);

  // Auto-dismiss offline-ready after 6 seconds
  useEffect(() => {
    if (offlineReady && !needRefresh) {
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 6000);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
    return undefined;
  }, [offlineReady, needRefresh, dismiss]);

  const show = needRefresh || offlineReady;

  const getIcon = () => {
    if (needRefresh) {
      return (
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-accent-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="sw-update-banner"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] w-full max-w-[calc(100vw-2rem)] sm:max-w-md pointer-events-auto"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-background-secondary border border-border shadow-lg">
            {getIcon()}
            <p className="flex-1 text-sm text-foreground">
              {needRefresh ? t('sw.updateAvailable') : t('sw.offlineReady')}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {needRefresh && (
                <Button variant="primary" size="sm" onClick={handleUpdate}>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
