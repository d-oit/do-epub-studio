import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './features/auth/LoginPage';
import { ReaderPage } from './features/reader/ReaderPage';
import { AdminLoginPage } from './features/admin/AdminLoginPage';
import { AdminBookResponsesPage } from './features/admin/BooksPage';
import { AdminGrantResponsesPage } from './features/admin/GrantsPage';
import { AdminAuditPage } from './features/admin/AuditLogPage';

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
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
