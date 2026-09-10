import React, { Suspense } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { ViewTransitionRoutes } from './components/ViewTransitionRoutes';
import { useAuthStore } from './stores/auth';
import { useThemeSync } from './hooks/useThemeSync';
import { useSessionExpiry } from './hooks/useSessionExpiry';
import { useTranslation } from './hooks/useTranslation';
import { useDocumentLocale } from './hooks/useDocumentLocale';
import { AppShell } from './components/AppShell';
import { SwUpdateNotification } from './components/SwUpdateNotification';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotFoundPage } from './features/errors/NotFoundPage';
import {
  AdminSkeleton,
  ReaderSkeleton,
  AuthSkeleton,
} from './components/skeletons';

// Lazy load route components (named exports). GOAP-224 C5: auth pages
// (/login, /admin/login, /admin/recover) were eagerly imported into the main
// bundle although they render only on auth routes — same treatment as all other
// route pages below.
const LoginPage = React.lazy(() =>
  import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const AdminLoginPage = React.lazy(() =>
  import('./features/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminRecoverPage = React.lazy(() =>
  import('./features/admin/AdminRecoverPage').then((m) => ({ default: m.AdminRecoverPage }))
);
const ReaderPage = React.lazy(() =>
  import('./features/reader/ReaderPage').then((m) => ({ default: m.ReaderPage }))
);
const AdminBookResponsesPage = React.lazy(() =>
  import('./features/admin/BooksPage').then((m) => ({ default: m.AdminBookResponsesPage }))
);
const AdminGrantResponsesPage = React.lazy(() =>
  import('./features/admin/GrantsPage').then((m) => ({ default: m.AdminGrantResponsesPage }))
);
const AdminAuditPage = React.lazy(() =>
  import('./features/admin/AuditLogPage').then((m) => ({ default: m.AdminAuditPage }))
);
const AccountSettingsPage = React.lazy(() =>
  import('./features/admin/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage }))
);
const CatalogPage = React.lazy(() =>
  import('./features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage }))
);
const HelpPage = React.lazy(() =>
  import('./features/help/HelpPage').then((m) => ({ default: m.HelpPage }))
);
const MyLibraryPage = React.lazy(() =>
  import('./features/library/MyLibraryPage').then((m) => ({ default: m.MyLibraryPage }))
);
const AdminDashboard = React.lazy(() =>
  import('./features/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const SettingsPage = React.lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

// Premium glassmorphism loading fallback spinner
// GOAP-224 B12: `LoadingFallback` was unreachable — every lazy route is wrapped
// in its own nested <Suspense> with a page skeleton, so the top-level Suspense
// below never suspends. Removed along with its now-dead `useTranslation` import.

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionExpired = useAuthStore((state) => state.sessionExpired);

  if (!isAuthenticated) {
    const target = sessionExpired
      ? '/login?error=session_expired'
      : '/login';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, sessionExpired } = useAuthStore();

  if (!isAuthenticated || !isAdmin) {
    // When the API client flipped the sessionExpired flag (401
    // handling), route to the reader login with a query param so the
    // UI can show "Session expired" copy. The admin login page would
    // loop because AdminRoute guards it on the same predicate.
    const target = sessionExpired
      ? '/login?error=session_expired'
      : '/admin/login';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

// GOAP-268 UX-01: root session routing is immediate (no timer) and separate
// from the persistent layout. Preserves the pre-shell destinations exactly:
// admin → /admin, book session → /read/:slug, everything else → /login.
function RootIndexRoute() {
  const { isAuthenticated, isAdmin, bookSlug } = useAuthStore();

  if (isAuthenticated) {
    if (isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (bookSlug) {
      return <Navigate to={`/read/${bookSlug}`} replace />;
    }
  }

  return <Navigate to="/login" replace />;
}

// GOAP-268 UX-01: minimal loading fallback for routes nested inside AppShell.
// The full-page skeletons render their own header bar, which would duplicate
// the shell header while the lazy chunk loads.
function ShellRouteFallback() {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center justify-center py-16"
      role="status"
      aria-live="polite"
      aria-label={t('a11y.loading_page')}
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" aria-hidden="true" />
    </div>
  );
}

// App is exported as a named export (no default) to avoid a duplicate
// export knip warning. main.tsx imports { App }.
export function App() {
  useThemeSync();
  useSessionExpiry();
  useDocumentLocale();

  return (
    <Suspense fallback={null}>
      {/* Skip-to-content link — WCAG 2.4.1: first focusable element in the page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:font-medium focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <SwUpdateNotification />
      <OfflineIndicator />
      <ViewTransitionRoutes>
        {/* GOAP-268 UX-01: `/` is a layout parent. Core routes nest inside so
            AppShell (nav + single main landmark) renders persistently.
            Auth, reader, admin, help, and 404 stay outside the shell. */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<RootIndexRoute />} />
          <Route path="catalog" element={<Suspense fallback={<ShellRouteFallback />}><CatalogPage /></Suspense>} />
          <Route path="library" element={
            <ProtectedRoute>
              <Suspense fallback={<ShellRouteFallback />}><MyLibraryPage /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute>
              <Suspense fallback={<ShellRouteFallback />}><SettingsPage /></Suspense>
            </ProtectedRoute>
          } />
        </Route>
        <Route path="/help" element={<Suspense fallback={<AuthSkeleton />}><HelpPage /></Suspense>} />
        <Route path="/login" element={<Suspense fallback={<AuthSkeleton />}><LoginPage /></Suspense>} />
        <Route path="/admin/login" element={<Suspense fallback={<AuthSkeleton />}><AdminLoginPage /></Suspense>} />
        <Route path="/admin/recover" element={<Suspense fallback={<AuthSkeleton />}><AdminRecoverPage /></Suspense>} />
        <Route path="/read/:bookSlug" element={
          <ProtectedRoute>
            <Suspense fallback={<ReaderSkeleton />}><ReaderPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AdminDashboard /></Suspense>
          </AdminRoute>
        } />
        <Route path="/admin/books" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AdminBookResponsesPage /></Suspense>
          </AdminRoute>
        } />
        <Route path="/admin/grants" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AdminGrantResponsesPage /></Suspense>
          </AdminRoute>
        } />
        <Route path="/admin/books/:bookId/grants" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AdminGrantResponsesPage /></Suspense>
          </AdminRoute>
        } />
        <Route path="/admin/audit" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AdminAuditPage /></Suspense>
          </AdminRoute>
        } />
        <Route path="/admin/account" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AccountSettingsPage /></Suspense>
          </AdminRoute>
        } />
        {/* Static hosts serve /index.html as the SPA entry; treat it as the
            root so it reaches the login instead of the catch-all 404. */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </ViewTransitionRoutes>
    </Suspense>
  );
}
