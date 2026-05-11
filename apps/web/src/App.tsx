import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './features/auth/LoginPage';
import { ReaderPage } from './features/reader/ReaderPage';
import { AdminBooksPage } from './features/admin/BooksPage';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { GrantsPage } from './features/admin/GrantsPage';
import { AdminAuditPage } from './features/admin/AuditLogPage';

/**
 * Hook to apply theme class and backgroundColor to document.body.
 * Responds to system theme changes and ensures background covers full scrollable area.
 */
function useBodyTheme() {
  const isDark = useAuthStore((state) => state.isDark);

  React.useEffect(() => {
    const applyTheme = (dark: boolean) => {
      if (dark) {
        document.body.classList.add('dark');
        document.body.style.backgroundColor = '#0a0a0a';
      } else {
        document.body.classList.remove('dark');
        document.body.style.backgroundColor = '#ffffff';
      }
    };

    applyTheme(isDark);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
return () => { mediaQuery.removeEventListener('change', handleChange); };
  }, [isDark]);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuthStore();

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  useBodyTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/read/:bookSlug" element={
        <ProtectedRoute>
          <ReaderPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/books" element={
        <AdminRoute>
          <AdminBooksPage />
        </AdminRoute>
      } />
      <Route path="/admin/grants" element={
        <AdminRoute>
          <GrantsPage />
        </AdminRoute>
      } />
      <Route path="/admin/books/:bookId/grants" element={
        <AdminRoute>
          <GrantsPage />
        </AdminRoute>
      } />
      <Route path="/admin/audit" element={
        <AdminRoute>
          <AdminAuditPage />
        </AdminRoute>
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
