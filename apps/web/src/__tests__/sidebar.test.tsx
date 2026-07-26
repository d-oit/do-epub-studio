import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.catalog': 'Catalog',
        'nav.myLibrary': 'My Library',
        'nav.settings': 'Settings',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../components/ui', () => ({
  AppLogo: ({ size: _size, ...props }: { size?: number; [key: string]: unknown }) => <div data-testid="app-logo" {...props} />,
}));

vi.mock('../components/navigation/shared', () => ({
  NAV_ITEMS: [
    { key: 'nav.catalog', icon: 'library', href: '/catalog' },
    { key: 'nav.myLibrary', icon: 'book-open', href: '/library' },
    { key: 'nav.settings', icon: 'settings', href: '/settings' },
  ],
  NavIcon: ({ icon, ...props }: { icon: string; [key: string]: unknown }) => <span data-testid={`nav-icon-${icon}`} {...props} />,
}));

vi.mock('../config/app-identity', () => ({
  APP_NAME: 'd.o.EPUB Studio',
  APP_VERSION_LABEL: 'v1.0.0',
}));

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app logo', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('app-logo')).toBeInTheDocument();
  });

  it('renders the app name and version', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText('d.o.EPUB Studio')).toBeInTheDocument();
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
  });

  it('renders all navigation items', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('My Library')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders nav icons for each item', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('nav-icon-library')).toBeInTheDocument();
    expect(screen.getByTestId('nav-icon-book-open')).toBeInTheDocument();
    expect(screen.getByTestId('nav-icon-settings')).toBeInTheDocument();
  });

  it('renders navigation links with correct hrefs', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/catalog');
    expect(screen.getByRole('link', { name: 'My Library' })).toHaveAttribute('href', '/library');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('has accessible nav landmark with translated label', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Catalog' })).toBeInTheDocument();
  });

  it('renders the aside as root container', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    const aside = container.querySelector('aside');
    expect(aside).toBeInTheDocument();
    expect(aside).toHaveClass('sidebar-nav');
  });
});
