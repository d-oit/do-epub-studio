import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useTranslation } from '../hooks/useTranslation';
import { AppLogo } from './ui';
import { BottomTabBar, Sidebar, Drawer } from './navigation';
import { APP_NAME, APP_VERSION_LABEL } from '../config/app-identity';

export function AppShell() {
  const navigate = useNavigate();
  const { isAuthenticated, bookSlug, isAdmin } = useAuthStore();
  const [isResolving, setIsResolving] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsResolving(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isResolving) {
      const options = { replace: true };
      if (isAuthenticated) {
        if (isAdmin) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
          navigate('/admin', options);
        } else if (bookSlug) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
          navigate(`/read/${bookSlug}`, options);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
          navigate('/login', options);
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- navigate() returns void, not Promise (react-router-dom v7)
        navigate('/login', options);
      }
    }
  }, [isResolving, isAuthenticated, bookSlug, isAdmin, navigate]);

  const toggleDrawer = useCallback(() => { setDrawerOpen((prev) => !prev); }, []);

  if (isResolving) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6">
        <div
          className="flex flex-col items-center gap-8 w-full max-w-md animate-scale-in"
          role="status"
          aria-live="polite"
          aria-label={t('a11y.loading_app')}
        >
          <AppLogo size={64} className="text-accent animate-pulse" />
          <div className="space-y-4 w-full">
            <div className="h-8 w-3/4 mx-auto rounded-lg skeleton" />
            <div className="h-4 w-1/2 mx-auto rounded-md skeleton" />
          </div>
          <div className="flex gap-2 mt-4" aria-hidden="true">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-accent/60 animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 rounded-full bg-accent/30 animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <Drawer isOpen={drawerOpen} onClose={() => { setDrawerOpen(false); }} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-4 h-14 bg-background-secondary border-b border-border lg:hidden shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDrawer}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
              aria-label={t('a11y.menu_open')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <AppLogo size={24} className="text-accent" />
            <span className="min-w-0 truncate font-semibold text-foreground text-sm">{APP_NAME}</span>
            <span className="hidden text-[0.68rem] text-foreground-muted sm:inline">{APP_VERSION_LABEL}</span>
          </div>
        </header>
        {/* Main scrollable area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto overscroll-behavior-contain p-4 pb-20 lg:p-6"
        >
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
