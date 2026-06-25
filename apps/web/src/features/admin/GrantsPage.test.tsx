import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AdminGrantResponsesPage } from './GrantsPage';
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
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    return selector ? selector(mockAuth) : mockAuth;
  },
}));

vi.mock('../../lib/api', () => ({
  apiRequest: vi.fn(),
}));

const mockBooks = [{ id: 'b1', title: 'Book 1', slug: 'b1' }, { id: 'b2', title: 'Book 2', slug: 'b2' }];
const mockGrants = [{
  id: 'g1',
  email: 'u1@ex.com',
  mode: 'reader_only',
  offlineAllowed: true,
  commentsAllowed: true,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  revokedAt: null,
}];

async function renderAndFlush(initialPath: string) {
  await act(() => {
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/grants" element={<AdminGrantResponsesPage />} />
          <Route path="/admin/books/:bookId/grants" element={<AdminGrantResponsesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    return Promise.resolve();
  });
}

describe('AdminGrantResponsesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders grants table', async () => {
    vi.mocked(api.apiRequest).mockImplementation((url: string) => {
      if (url === '/api/admin/books') return Promise.resolve(mockBooks);
      if (url.includes('/grants')) return Promise.resolve(mockGrants);
      return Promise.resolve([]);
    });

    await renderAndFlush('/admin/books/b1/grants');

    expect(screen.getByText('u1@ex.com')).toBeInTheDocument();
  });

  it('shows select book prompt when no book selected', async () => {
    vi.mocked(api.apiRequest).mockImplementation((url: string) => {
      if (url === '/api/admin/books') return Promise.resolve(mockBooks);
      return Promise.resolve([]);
    });

    await renderAndFlush('/admin/grants');

    expect(screen.getByText('grants.selectBookPrompt')).toBeInTheDocument();
  });

  it('opens create modal and submits', async () => {
    vi.mocked(api.apiRequest).mockImplementation((url: string) => {
      if (url === '/api/admin/books') return Promise.resolve(mockBooks);
      if (url.includes('/grants')) return Promise.resolve([]);
      return Promise.resolve({ ok: true });
    });

    await renderAndFlush('/admin/books/b1/grants');

    const createBtn = screen.getByRole('button', { name: 'grants.createGrant' });
    fireEvent.click(createBtn);

    expect(screen.getByText('grants.createGrantTitle')).toBeInTheDocument();

    const modal = screen.getByRole('dialog');
    fireEvent.change(within(modal).getByLabelText('grants.form.email'), { target: { value: 'new@ex.com' } });
    fireEvent.change(within(modal).getByLabelText('grants.form.password'), { target: { value: 'password123' } });
    fireEvent.change(within(modal).getByLabelText('grants.form.passwordConfirm'), { target: { value: 'password123' } });

    // React 19 form actions fire on form submit, not button click in jsdom.
    const modalForm = modal.querySelector('form');
    expect(modalForm).toBeInTheDocument();
    if (modalForm) {
      act(() => {
        fireEvent.submit(modalForm);
      });
    }

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/api/admin/books/b1/grants', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('opens edit modal and patches', async () => {
    vi.mocked(api.apiRequest).mockImplementation((url: string) => {
      if (url === '/api/admin/books') return Promise.resolve(mockBooks);
      if (url.includes('/grants')) return Promise.resolve(mockGrants);
      return Promise.resolve({ ok: true });
    });

    await renderAndFlush('/admin/books/b1/grants');

    const editBtn = screen.getByText('grants.actions.edit');
    fireEvent.click(editBtn);

    expect(screen.getByText('grants.editGrantTitle')).toBeInTheDocument();

    const modal = screen.getByRole('dialog');
    const emailInput = within(modal).getByLabelText('grants.form.email');
    expect(emailInput).toHaveAttribute('readonly');

    const modalForm = modal.querySelector('form');
    expect(modalForm).toBeInTheDocument();
    // Use requestSubmit which simulates a real user submission in jsdom.
    await act(async () => {
      (modalForm as HTMLFormElement).requestSubmit();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(api.apiRequest).toHaveBeenCalledWith(
          '/api/admin/grants/g1',
          expect.objectContaining({ method: 'PATCH' }),
        );
      },
      { timeout: 5000 },
    );
  });

  it('revokes a grant', async () => {
    vi.mocked(api.apiRequest).mockImplementation((url: string) => {
      if (url === '/api/admin/books') return Promise.resolve(mockBooks);
      if (url.includes('/grants')) return Promise.resolve(mockGrants);
      return Promise.resolve({ ok: true });
    });

    await renderAndFlush('/admin/books/b1/grants');

    const revokeBtn = screen.getByText('grants.actions.revoke');
    fireEvent.click(revokeBtn);

    expect(screen.getByText('grants.revokeTitle')).toBeInTheDocument();

    const modal = screen.getByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: 'grants.actions.revoke' }));

    await waitFor(() => {
      expect(api.apiRequest).toHaveBeenCalledWith('/api/admin/grants/g1/revoke', expect.objectContaining({
        method: 'POST',
      }));
    });
  });
});
