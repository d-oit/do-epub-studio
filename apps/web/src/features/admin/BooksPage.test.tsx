import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminBooksPage } from './BooksPage';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../../lib/api';

// Stable mock values
const mockT = (k: string) => k;
const mockAuth = {
  sessionToken: 'token',
  email: 'admin@ex.com',
  isAdmin: true,
  logout: vi.fn(),
};

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => mockAuth,
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockBooks = [
  { id: '1', slug: 'b1', title: 'Book 1', authorName: 'A1', visibility: 'public', coverImageUrl: null }
];

describe('AdminBooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders books after loading', async () => {
    vi.mocked(api.apiRequest).mockResolvedValue(mockBooks);

    render(
      <MemoryRouter>
        <AdminBooksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Book 1')).toBeInTheDocument();
  });

  it('shows empty state when no books', async () => {
    vi.mocked(api.apiRequest).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <AdminBooksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('admin.noBooks')).toBeInTheDocument();
  });
});
