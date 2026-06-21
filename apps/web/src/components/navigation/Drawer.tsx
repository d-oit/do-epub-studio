import { useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../hooks/useTranslation';
import { AppLogo } from '../../components/ui';
import { NAV_ITEMS, NavIcon } from './shared';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Drawer({ isOpen, onClose }: DrawerProps) {
  const { t } = useTranslation();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-50 w-64 bg-background-secondary border-r border-border shadow-lg md:hidden flex flex-col"
            role="dialog"
            aria-label={t('nav.library')}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <AppLogo size={28} className="text-accent shrink-0" />
                <div className="min-w-0">
                  <span className="block truncate font-semibold text-foreground text-sm">{APP_NAME}</span>
                  <span className="block text-xs text-foreground-muted">{APP_VERSION_LABEL}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
                aria-label={t('reader.settings.close')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 py-3" aria-label={t('nav.library')}>
              {NAV_ITEMS.map(({ key, icon, href }) => (
                <NavLink
                  key={key}
                  to={href}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                      isActive
                        ? 'text-accent bg-accent/10 border-r-2 border-accent'
                        : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                    }`
                  }
                  aria-label={t(key)}
                >
                  {({ isActive }) => (
                    <>
                      <NavIcon icon={icon} className={`w-5 h-5 shrink-0 ${isActive ? 'text-accent' : ''}`} />
                      <span>{t(key)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
