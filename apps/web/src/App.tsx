import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { AppShell } from './components/AppShell';
import { Spinner } from '@do-epub-studio/ui';
import React, { lazy, Suspense } from 'react';

const LoginPage = lazy(() => import('./features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const ReaderPage = lazy(() => import('./features/reader/ReaderPage').then(m => ({ default: m.ReaderPage })));
const AdminLoginPage = lazy(() => import('./features/admin/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminBookResponsesPage = lazy(() => import('./features/admin/BooksPage').then(m => ({ default: m.AdminBookResponsesPage })));
const AdminGrantResponsesPage = lazy(() => import('./features/admin/GrantsPage').then(m => ({ default: m.AdminGrantResponsesPage })));
const AdminAuditPage = lazy(() => import('./features/admin/AuditLogPage').then(m => ({ default: m.AdminAuditPage })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuthStore();

  if (!isAuthenticated || !isAdmin) {
    return <AdminLoginPage />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-background">
          <Spinner size="lg" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/read/:bookSlug"
          element={
            <ProtectedRoute>
              <ReaderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/books"
          element={
            <AdminRoute>
              <AdminBookResponsesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/grants"
          element={
            <AdminRoute>
              <AdminGrantResponsesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/books/:bookId/grants"
          element={
            <AdminRoute>
              <AdminGrantResponsesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <AdminRoute>
              <AdminAuditPage />
            </AdminRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default App;
