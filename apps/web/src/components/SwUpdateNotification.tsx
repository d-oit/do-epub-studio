import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwUpdateStore } from '../stores/sw-update';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui';

export function SwUpdateNotification() {
  const { t } = useTranslation();
  const needRefresh = useSwUpdateStore((s) => s.needRefresh);
  const offlineReady = useSwUpdateStore((s) => s.offlineReady);
  const updateServiceWorker = useSwUpdateStore((s) => s.updateServiceWorker);
  const dismiss = useSwUpdateStore((s) => s.dismiss);

  const handleUpdate = useCallback(() => {
    updateServiceWorker?.();
    dismiss();
  }, [updateServiceWorker, dismiss]);

  const handleDismiss = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const show = needRefresh || offlineReady;
  const message = needRefresh ? t('sw.updateAvailable') : t('sw.offlineReady');

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="sw-update-banner"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
          role="alert"
          aria-live="polite"
        >
          <div className="mt-4 mx-4 w-full max-w-lg pointer-events-auto rounded-2xl bg-surface/80 backdrop-blur-xl border border-white/10 shadow-glass-lg p-4 flex items-center gap-4">
            <div className="flex-1 text-sm text-foreground/90">
              {message}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needRefresh && (
                <Button variant="primary" size="sm" onClick={handleUpdate}>
                  {t('sw.updateAction')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                {t('sw.dismissAction')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
