import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GrantsPage } from './GrantsPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as api from '../../lib/api';

// Stable mock values
const mockT = (k: string) => k;
const mockAuth = {
  sessionToken: 'token',
  email: 'admin@ex.com',
  isAdmin: true,
  capabilities: { canManageAccess: true },
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

const mockBooks = [{ id: 'b1', title: 'Book 1', slug: 'b1' }];
const mockGrants = [{
  id: 'g1',
  email: 'u1@ex.com',
  mode: 'read',
  offlineAllowed: true,
  commentsAllowed: true,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString()
}];

describe('GrantsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders grants table', async () => {
    vi.mocked(api.apiRequest).mockImplementation(async (url: string) => {
      if (url === '/api/books') return mockBooks;
      if (url.includes('/grants')) return mockGrants;
      return [];
    });

    render(
      <MemoryRouter initialEntries={['/admin/books/b1/grants']}>
        <Routes>
          <Route path="/admin/books/:bookId/grants" element={<GrantsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('u1@ex.com')).toBeInTheDocument();
    expect(screen.getByText('Book 1')).toBeInTheDocument();
  });

  it('shows empty state when no grants', async () => {
    vi.mocked(api.apiRequest).mockImplementation(async (url: string) => {
      if (url === '/api/books') return mockBooks;
      if (url.includes('/grants')) return [];
      return [];
    });

    render(
      <MemoryRouter initialEntries={['/admin/books/b1/grants']}>
        <Routes>
          <Route path="/admin/books/:bookId/grants" element={<GrantsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('grants.noGrants')).toBeInTheDocument();
  });
});
