import React, { Suspense } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { ViewTransitionRoutes } from './components/ViewTransitionRoutes';
import { useAuthStore } from './stores/auth';
import { useThemeSync } from './hooks/useThemeSync';
import { useSessionExpiry } from './hooks/useSessionExpiry';
import { useDocumentLocale } from './hooks/useDocumentLocale';
import { LoginPage } from './features/auth/LoginPage';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { AdminRecoverPage } from './features/admin/AdminRecoverPage';
import { AppShell } from './components/AppShell';
import { SwUpdateNotification } from './components/SwUpdateNotification';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotFoundPage } from './features/errors/NotFoundPage';
import {
  LibrarySkeleton,
  CatalogSkeleton,
  AdminSkeleton,
  ReaderSkeleton,
  SettingsSkeleton,
} from './components/skeletons';

// Lazy load route components (named exports)
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
const CatalogPage = React.lazy(() =>
  import('./features/catalog/CatalogPage').then((m) => ({ default: m.CatalogPage }))
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
        <Route path="/" element={<AppShell />} />
        <Route path="/catalog" element={<Suspense fallback={<CatalogSkeleton />}><CatalogPage /></Suspense>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/recover" element={<AdminRecoverPage />} />
        <Route path="/read/:bookSlug" element={
          <ProtectedRoute>
            <Suspense fallback={<ReaderSkeleton />}><ReaderPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/library" element={
          <ProtectedRoute>
            <Suspense fallback={<LibrarySkeleton />}><MyLibraryPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute>
            <Suspense fallback={<AdminSkeleton />}><AdminDashboard /></Suspense>
          </AdminRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Suspense fallback={<SettingsSkeleton />}><SettingsPage /></Suspense>
          </ProtectedRoute>
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
        <Route path="*" element={<NotFoundPage />} />
      </ViewTransitionRoutes>
    </Suspense>
  );
}
