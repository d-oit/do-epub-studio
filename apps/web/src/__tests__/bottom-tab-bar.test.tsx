import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomTabBar } from '../components/navigation/BottomTabBar';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: vi.fn((key: string) => {
      const translations = new Map<string, string>([
        ['nav.catalog', 'Catalog'],
        ['nav.myLibrary', 'My Library'],
        ['nav.settings', 'Settings'],
      ]);
      return translations.get(key) ?? key;
    }),
  }),
}));

vi.mock('../components/navigation/shared', () => ({
  NAV_ITEMS: [
    { key: 'nav.catalog', icon: 'library', href: '/catalog' },
    { key: 'nav.myLibrary', icon: 'book-open', href: '/library' },
    { key: 'nav.settings', icon: 'settings', href: '/settings' },
  ],
  NavIcon: ({ icon, ...props }: { icon: string; [key: string]: unknown }) => <span data-testid={`nav-icon-${icon}`} {...props} />,
}));

describe('BottomTabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a nav landmark with accessible label', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Catalog' })).toBeInTheDocument();
  });

  it('renders all tab items', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByText('Catalog')).toBeInTheDocument();
    expect(screen.getByText('My Library')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders nav icons for each tab', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('nav-icon-library')).toBeInTheDocument();
    expect(screen.getByTestId('nav-icon-book-open')).toBeInTheDocument();
    expect(screen.getByTestId('nav-icon-settings')).toBeInTheDocument();
  });

  it('renders links with correct hrefs', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/catalog');
    expect(screen.getByRole('link', { name: 'My Library' })).toHaveAttribute('href', '/library');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
  });

  it('is fixed at the bottom of the viewport', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Catalog' });
    expect(nav).toHaveClass('fixed', 'bottom-0', 'z-40');
  });

  // GOAP-268 UX-01: the tab bar owns widths below lg, where the sidebar
  // takes over — the drawer uses the same breakpoint so no width is
  // left without a primary navigation mechanism.
  it('hides at the lg breakpoint where the sidebar takes over', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Catalog' })).toHaveClass('lg:hidden');
  });

  it('marks the active tab with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <BottomTabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'My Library' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Catalog' })).not.toHaveAttribute('aria-current', 'page');
  });

  it('has correct structural classes for tab layout', () => {
    render(
      <MemoryRouter>
        <BottomTabBar />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Catalog' });
    expect(nav).toHaveClass('bottom-tab-bar', 'bg-background-secondary');
    const tabContainer = nav.querySelector('.flex.items-center.justify-around');
    expect(tabContainer).toBeInTheDocument();
  });
});
