import React, { Suspense } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { ViewTransitionRoutes } from './components/ViewTransitionRoutes';
import { useAuthStore } from './stores/auth';
import { useThemeSync } from './hooks/useThemeSync';
import { useSessionExpiry } from './hooks/useSessionExpiry';
import { useTranslation } from './hooks/useTranslation';
import { LoginPage } from './features/auth/LoginPage';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { AdminRecoverPage } from './features/admin/AdminRecoverPage';
import { AppShell } from './components/AppShell';
import { SwUpdateNotification } from './components/SwUpdateNotification';
import { OfflineIndicator } from './components/OfflineIndicator';
import { NotFoundPage } from './features/errors/NotFoundPage';

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

// Premium glassmorphism loading fallback spinner
// biome-ignore lint/correctness/useQwikValidLexicalScope: React project, not Qwik — false positive
const LoadingFallback: React.FC = () => {
  const { t } = useTranslation();
  return (
  <div
    className="min-h-screen bg-background flex flex-col items-center justify-center p-6"
    role="status"
    aria-live="polite"
    aria-label={t('a11y.loading_page')}
  >
    <div className="flex flex-col items-center gap-6 w-full max-w-xs p-8 rounded-3xl bg-surface/40 backdrop-blur-md border border-white/5 shadow-glass">
      <div
        className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shadow-glass animate-pulse"
        aria-hidden="true"
      >
        <svg
          className="w-7 h-7 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </div>
      <div className="flex gap-2.5 mt-2" aria-hidden="true">
        <div className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2.5 h-2.5 rounded-full bg-accent/60 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2.5 h-2.5 rounded-full bg-accent/30 animate-bounce" />
      </div>
    </div>
  </div>
  );
};

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

export function App() {
  useThemeSync();
  useSessionExpiry();

  return (
    <Suspense fallback={<LoadingFallback />}>
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
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/recover" element={<AdminRecoverPage />} />
        <Route path="/read/:bookSlug" element={
          <ProtectedRoute>
            <ReaderPage />
          </ProtectedRoute>
        } />
        <Route path="/admin/books" element={
          <AdminRoute>
            <AdminBookResponsesPage />
          </AdminRoute>
        } />
        <Route path="/admin/grants" element={
          <AdminRoute>
            <AdminGrantResponsesPage />
          </AdminRoute>
        } />
        <Route path="/admin/books/:bookId/grants" element={
          <AdminRoute>
            <AdminGrantResponsesPage />
          </AdminRoute>
        } />
        <Route path="/admin/audit" element={
          <AdminRoute>
            <AdminAuditPage />
          </AdminRoute>
        } />
        <Route path="*" element={<NotFoundPage />} />
      </ViewTransitionRoutes>
    </Suspense>
  );
}

export default App;
