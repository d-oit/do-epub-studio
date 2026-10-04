import { useEffect } from 'react';

import { useLocaleStore } from '../stores/locale';

/**
 * The single owner of the locale-retry reload (A9/GOAP-306).
 *
 * A failed dynamic import stays rejected for the document's lifetime, so the
 * only working retry is a fresh load. That navigation must not live in
 * `useTranslation`: every mounted consumer would run it, a component that
 * mounted *after* the failure would reload without any user action, and an
 * outage could keep reloading. The store sets `reloadRequested` only when the
 * user reselects a locale that already failed, and this hook — mounted once,
 * next to `useDocumentLocale` — performs exactly one reload for that request.
 */
export function useLocaleReload(): void {
  const reloadRequested = useLocaleStore((state) => state.reloadRequested);

  useEffect(() => {
    if (reloadRequested) {
      window.location.reload();
    }
  }, [reloadRequested]);
}
