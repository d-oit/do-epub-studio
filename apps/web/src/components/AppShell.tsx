import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { AppLogo } from './ui';
import { BottomTabBar, Sidebar, Drawer } from './navigation';
import { APP_NAME, APP_VERSION_LABEL } from '../config/app-identity';
import { useAuthStore } from '../stores/auth';
import { useReaderStore } from '../stores/reader';

// GOAP-268 UX-01: AppShell is a pure persistent layout. Root session routing
// lives in the index route (App.tsx `RootIndexRoute`) and runs immediately —
// the shell never redirects and owns the single `main#main-content` landmark;
// nested pages own presentation only.
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pendingSyncCount = useReaderStore((s) => s.pendingSyncCount);
  const toggleDrawer = useCallback(() => { setDrawerOpen((prev) => !prev); }, []);

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
          className="flex-1 overflow-y-auto overscroll-behavior-contain p-4 pb-20 lg:p-6 scroll-pt-14 scroll-pb-14"
        >
          {isAuthenticated && pendingSyncCount > 0 && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mb-4 rounded-sm border border-border bg-background-secondary px-3 py-2 text-sm text-foreground-muted"
            >
              {t('offline.pendingSync', { count: pendingSyncCount })}
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
