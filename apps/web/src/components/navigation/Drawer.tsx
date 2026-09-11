import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useFocusTrap } from '@do-epub-studio/ui';
import { useTranslation } from '../../hooks/useTranslation';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AppLogo } from '../../components/ui';
import { NAV_ITEMS, NavIcon } from './shared';
import { APP_NAME, APP_VERSION_LABEL } from '../../config/app-identity';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Drawer({ isOpen, onClose }: DrawerProps) {
  const { t, locale } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useFocusTrap(isOpen && shouldRender && !isExiting, contentRef, triggerRef);

  useEffect(() => {
    if (isOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        triggerRef.current = activeElement;
      }
      setShouldRender(true);
      setIsExiting(false);
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      if (triggerRef.current) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  // Initial focus move into the drawer when mounted
  useEffect(() => {
    if (isOpen && shouldRender && !isExiting && contentRef.current) {
      if (!contentRef.current.contains(document.activeElement)) {
        const firstFocusable = contentRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          contentRef.current.focus();
        }
      }
    }
  }, [isOpen, shouldRender, isExiting]);

  // Exit animation handling respecting reduced motion preference
  useEffect(() => {
    if (!isOpen && shouldRender) {
      if (prefersReducedMotion) {
        setShouldRender(false);
        setIsExiting(false);
        return;
      }

      setIsExiting(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender, prefersReducedMotion]);

  // Resizing into desktop closes and unlocks the hidden drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleDesktopCheck = () => {
      const mqlMatches =
        typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
      const widthMatches = window.innerWidth >= 1024;
      if (mqlMatches || widthMatches) {
        onClose();
      }
    };

    const mql =
      typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 1024px)') : null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        onClose();
      }
    };

    mql?.addEventListener('change', handleMediaChange);
    window.addEventListener('resize', handleDesktopCheck);

    return () => {
      mql?.removeEventListener('change', handleMediaChange);
      window.removeEventListener('resize', handleDesktopCheck);
    };
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  const isRtl =
    locale === 'ar' || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');
  const slideInClass = isRtl ? 'animate-slide-in-right' : 'animate-slide-in-left';
  const slideOutClass = isRtl ? 'animate-slide-out-right' : 'animate-slide-out-left';
  const animationClass = prefersReducedMotion ? '' : isExiting ? slideOutClass : slideInClass;
  const scrimAnimationClass = prefersReducedMotion
    ? ''
    : isExiting
      ? 'animate-fade-out'
      : 'animate-fade-in';

  return (
    <>
      {/* Scrim */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 lg:hidden ${scrimAnimationClass}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <aside
        ref={contentRef}
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-background-secondary border-e border-border shadow-lg lg:hidden flex flex-col ${animationClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.catalog')}
        tabIndex={-1}
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
        {/* GOAP-268: no duplicate group label — the dialog aside above is
            already labelled, so this inner nav stays unnamed to keep the
            landmark tree unique when the drawer overlays the tab bar. */}
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map(({ key, icon, href }) => (
            <NavLink
              key={key}
              to={href}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  isActive
                    ? 'text-accent bg-accent/10 border-e-2 border-accent'
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
      </aside>
    </>
  );
}
