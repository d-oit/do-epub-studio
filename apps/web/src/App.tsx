import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { LoginPage } from './features/auth/LoginPage';
import { ReaderPage } from './features/reader/ReaderPage';
import { AdminBooksPage } from './features/admin/BooksPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/read/:bookSlug" element={
        <ProtectedRoute>
          <ReaderPage />
        </ProtectedRoute>
      } />
      <Route path="/admin/books" element={
        <ProtectedRoute>
          <AdminBooksPage />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
