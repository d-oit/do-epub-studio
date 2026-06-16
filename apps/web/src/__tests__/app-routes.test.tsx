import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

vi.mock('../hooks/useThemeSync', () => ({
  useThemeSync: vi.fn(),
}));

vi.mock('../hooks/useSessionExpiry', () => ({
  useSessionExpiry: vi.fn(),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../components/ViewTransitionRoutes', () => ({
  ViewTransitionRoutes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/SwUpdateNotification', () => ({
  SwUpdateNotification: () => null,
}));

vi.mock('../components/OfflineIndicator', () => ({
  OfflineIndicator: () => null,
}));

vi.mock('../features/auth/LoginPage', () => ({
  LoginPage: () => <div>Login Page</div>,
}));

vi.mock('../features/admin/AdminLoginPage', () => ({
  AdminLoginPage: () => <div>Admin Login Page</div>,
}));

vi.mock('../features/admin/BooksPage', () => ({
  AdminBookResponsesPage: () => <div>Books Page</div>,
}));

vi.mock('../features/admin/GrantsPage', () => ({
  AdminGrantResponsesPage: () => <div>Grants Page</div>,
}));

vi.mock('../features/admin/AuditLogPage', () => ({
  AdminAuditPage: () => <div>Audit Page</div>,
}));

vi.mock('../features/catalog/CatalogPage', () => ({
  CatalogPage: () => <div>Catalog Page</div>,
}));

vi.mock('../features/errors/NotFoundPage', () => ({
  NotFoundPage: () => <div>Not Found</div>,
}));

vi.mock('../features/reader/ReaderPage', () => ({
  ReaderPage: () => <div>Reader Page</div>,
}));

vi.mock('../components/AppShell', () => ({
  AppShell: () => <div>App Shell</div>,
}));

describe('App routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: false,
      isAdmin: false,
      bookSlug: null,
      email: null,
      capabilities: null,
    });
  });

  it('renders login page at /login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders catalog page at /catalog', () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <Routes>
          <Route path="/catalog" element={<div>Catalog Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Catalog Page')).toBeInTheDocument();
  });

  it('renders admin login at /admin/login', () => {
    render(
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<div>Admin Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Admin Login Page')).toBeInTheDocument();
  });

  it('renders 404 for unknown routes', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <Routes>
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });
});
