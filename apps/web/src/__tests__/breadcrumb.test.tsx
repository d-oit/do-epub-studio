import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumb } from '../components/navigation/Breadcrumb';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: vi.fn((key: string) => {
      const translations = new Map<string, string>([
        ['admin.breadcrumb.home', 'Home'],
        ['admin.breadcrumb.books', 'Books'],
        ['admin.breadcrumb.grants', 'Grants'],
        ['admin.breadcrumb.audit', 'Audit Log'],
      ]);
      return translations.get(key) ?? key;
    }),
  }),
}));

describe('Breadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a nav landmark with accessible label', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ labelKey: 'admin.breadcrumb.home', href: '/admin' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('renders a single item as current page without a link', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ labelKey: 'admin.breadcrumb.home' }]} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav.querySelector('ol')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the last item with aria-current="page"', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { labelKey: 'admin.breadcrumb.home', href: '/admin' },
            { labelKey: 'admin.breadcrumb.books' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Books')).toHaveAttribute('aria-current', 'page');
  });

  it('renders non-last items as links when href is provided', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { labelKey: 'admin.breadcrumb.home', href: '/admin' },
            { labelKey: 'admin.breadcrumb.books' },
          ]}
        />
      </MemoryRouter>,
    );
    const link = screen.getByText('Home');
    expect(link.closest('a')).toHaveAttribute('href', '/admin');
  });

  it('renders items without href as spans even if not last', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { labelKey: 'admin.breadcrumb.home' },
            { labelKey: 'admin.breadcrumb.books', href: '/books' },
            { labelKey: 'admin.breadcrumb.audit' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Home').tagName).toBe('SPAN');
    const booksLink = screen.getByText('Books').closest('a');
    expect(booksLink).not.toBeNull();
    expect(booksLink).toHaveAttribute('href', '/books');
  });

  it('renders separator icons between items', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { labelKey: 'admin.breadcrumb.home', href: '/admin' },
            { labelKey: 'admin.breadcrumb.books', href: '/books' },
            { labelKey: 'admin.breadcrumb.audit' },
          ]}
        />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const svgs = nav.querySelectorAll('svg[aria-hidden="true"]');
    expect(svgs.length).toBe(2);
  });

  it('renders all breadcrumb items in order', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { labelKey: 'admin.breadcrumb.home', href: '/admin' },
            { labelKey: 'admin.breadcrumb.books', href: '/books' },
            { labelKey: 'admin.breadcrumb.audit' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Books')).toBeInTheDocument();
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('does not render aria-current on non-last items', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { labelKey: 'admin.breadcrumb.home', href: '/admin' },
            { labelKey: 'admin.breadcrumb.books' },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Home')).not.toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Books')).toHaveAttribute('aria-current', 'page');
  });
});
