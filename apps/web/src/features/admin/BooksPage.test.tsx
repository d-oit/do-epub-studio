import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBooksPage } from './BooksPage';
import { MemoryRouter } from 'react-router-dom';

// Mock UI components from the feature-specific UI folder
vi.mock('../../components/ui', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span data-testid="badge">{children}</span>,
  Card: ({ children }: { children?: React.ReactNode }) => <div data-testid="card">{children}</div>,
  Header: ({ children }: { children?: React.ReactNode }) => <header data-testid="header">{children}</header>,
  Button: ({ children, onClick }: { children?: React.ReactNode, onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  IconButton: ({ children, onClick }: { children?: React.ReactNode, onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Input: ({ label }: { label?: string }) => (
    <div><label>{label}</label><input role="textbox" readOnly /></div>
  ),
  Modal: ({ children, isOpen, title }: { children?: React.ReactNode, isOpen?: boolean, title?: string }) => isOpen ? (
    <div role="dialog"><h2>{title}</h2>{children}</div>
  ) : null,
}));

// Mock generic UI components from @do-epub-studio/ui
vi.mock('@do-epub-studio/ui', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode, onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  Input: ({ label }: { label?: string }) => (
    <div><label>{label}</label><input role="textbox" readOnly /></div>
  ),
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
    logout: vi.fn(),
  }),
}));

import { apiRequest } from '../../lib/api';

const mockBooks = [
  { id: '1', slug: 'b1', title: 'Book 1', authorName: 'A1', visibility: 'public' as const, coverImageUrl: null }
];

describe.skip('AdminBooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders books after loading', async () => {
    vi.mocked(apiRequest).mockResolvedValue(mockBooks);
    render(<MemoryRouter><AdminBooksPage /></MemoryRouter>);

    expect(await screen.findByText('Book 1')).toBeInTheDocument();
  });

  it('shows empty state when no books', async () => {
    vi.mocked(apiRequest).mockResolvedValue([]);
    render(<MemoryRouter><AdminBooksPage /></MemoryRouter>);

    expect(await screen.findByText('admin.noBooks')).toBeInTheDocument();
  });
});
