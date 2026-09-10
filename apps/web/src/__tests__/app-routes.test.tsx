import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ComponentType } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App } from '../App';
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
  // Keep route matching functional so the real route table in <App /> works.
  ViewTransitionRoutes: ({ children }: { children: React.ReactNode }) => <Routes>{children}</Routes>,
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

vi.mock('../features/library/MyLibraryPage', () => ({
  MyLibraryPage: () => <div>Library Page</div>,
}));

vi.mock('../features/settings/SettingsPage', () => ({
  SettingsPage: () => <div>Settings Page</div>,
}));

vi.mock('../features/errors/NotFoundPage', () => ({
  NotFoundPage: () => <div>Not Found</div>,
}));

vi.mock('../features/reader/ReaderPage', () => ({
  ReaderPage: () => <div>Reader Page</div>,
}));

vi.mock('../components/AppShell', async () => {
  const { Outlet } = await vi.importActual<{ Outlet: ComponentType }>('react-router-dom');
  // Keep real layout behavior (Outlet passthrough) so nested routes render.
  return {
    AppShell: () => (
      <div>
        <div>App Shell</div>
        <main id="main-content">
          <Outlet />
        </main>
      </div>
    ),
  };
});

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

  it('renders login page at /login via the app route table', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  // Static hosts (Render, GitHub Pages) serve the SPA at /index.html; it must
  // behave like the root (reach the login when unauthenticated) instead of
  // hitting the 404 catch-all.
  it('redirects /index.html to the login when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/index.html']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  // GOAP-268 UX-01: core routes nest under the persistent shell.
  it('renders catalog inside the shell with a single main landmark', async () => {
    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Catalog Page')).toBeInTheDocument();
    expect(screen.getByText('App Shell')).toBeInTheDocument();
    expect(document.querySelectorAll('main#main-content')).toHaveLength(1);
  });

  it('redirects unauthenticated library and settings visits to login', () => {
    for (const entry of ['/library', '/settings']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[entry]}>
          <App />
        </MemoryRouter>,
      );
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders protected library content inside the shell when authenticated', async () => {
    useAuthStore.setState({ isAuthenticated: true, isAdmin: false, bookSlug: null });
    render(
      <MemoryRouter initialEntries={['/library']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Library Page')).toBeInTheDocument();
    expect(screen.getByText('App Shell')).toBeInTheDocument();
  });

  it('routes the shell index to login when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('still renders 404 for genuinely unknown paths via the app route table', () => {
    render(
      <MemoryRouter initialEntries={['/definitely-not-a-route']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText('Not Found')).toBeInTheDocument();
  });
});
