import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrantsPage } from './GrantsPage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@do-epub-studio/ui', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode, onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  Input: ({ label }: { label?: string }) => <div>{label}</div>,
  Modal: ({ children, isOpen, title }: { children?: React.ReactNode, isOpen?: boolean, title?: string }) => isOpen ? (
    <div role="dialog"><h2>{title}</h2>{children}</div>
  ) : null,
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionToken: 'token',
    email: 'admin@ex.com',
    capabilities: { canManageAccess: true },
    logout: vi.fn(),
  }),
}));

// We need to mock the full react-router-dom to control useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ bookId: 'b1' }),
    useNavigate: () => vi.fn(),
  };
});

import { apiRequest } from '../../lib/api';

describe.skip('GrantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockImplementation(async (url) => {
      if (url === '/api/books') return [{ id: 'b1', title: 'Book 1' }];
      if (url.includes('/grants')) return [{ id: 'g1', email: 'u1@ex.com', mode: 'read' }];
      return [];
    });
  });

  it('renders grants table', async () => {
    render(<MemoryRouter initialEntries={['/admin/books/b1/grants']}><GrantsPage /></MemoryRouter>);
    expect(await screen.findByText('u1@ex.com')).toBeInTheDocument();
  });

  it('shows empty state when no grants', async () => {
    vi.mocked(apiRequest).mockImplementation(async (url) => {
      if (url === '/api/books') return [{ id: 'b1', title: 'Book 1' }];
      if (url.includes('/grants')) return [];
      return [];
    });
    render(<MemoryRouter initialEntries={['/admin/books/b1/grants']}><GrantsPage /></MemoryRouter>);
    expect(await screen.findByText('grants.noGrants')).toBeInTheDocument();
  });
});
