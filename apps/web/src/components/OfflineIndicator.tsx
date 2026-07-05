import { useState, useEffect } from 'react';
import { useTranslation } from '../hooks/useTranslation';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const [shouldRender, setShouldRender] = useState(!navigator.onLine);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // biome-ignore lint/correctness/useQwikValidLexicalScope: React project, not Qwik — false positive
    const goOffline = () => { setShouldRender(true); setIsExiting(false); };
    // biome-ignore lint/correctness/useQwikValidLexicalScope: React project, not Qwik — false positive
    const goOnline = () => { setIsExiting(true); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isExiting]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[210] flex items-center justify-center px-4 py-2 bg-accent-warning/90 text-foreground text-sm font-medium ${isExiting ? 'animate-slide-out-top' : 'animate-slide-in-top'}`}
      role="alert"
      aria-live="assertive"
    >
      <svg className="w-4 h-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
      </svg>
      {t('offline.banner')}
    </div>
  );
}
