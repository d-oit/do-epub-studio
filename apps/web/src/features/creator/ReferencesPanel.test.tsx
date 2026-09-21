import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReferencesPanel } from './ReferencesPanel';
import { fetchReferences, fetchStyleProfile } from '../../lib/api/creator';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (s: { sessionToken: string }) => unknown) =>
    selector({ sessionToken: 'token' }),
}));

vi.mock('../../lib/api/creator', () => ({
  fetchReferences: vi.fn().mockResolvedValue([]),
  fetchStyleProfile: vi.fn().mockResolvedValue(null),
  createReference: vi.fn(),
  deleteReference: vi.fn(),
  verifyReference: vi.fn(),
  saveStyleProfile: vi.fn(),
}));

describe('ReferencesPanel (Wave 3)', () => {
  it('renders the empty state and style profile draft when nothing exists', async () => {
    render(
      <MemoryRouter>
        <ReferencesPanel bookId="book-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('ref.empty')).toBeInTheDocument();
    expect(screen.getByText('ref.styleTitle')).toBeInTheDocument();
    // An unapproved profile offers approval; no approver line is shown yet.
    expect(screen.getByRole('button', { name: 'ref.styleApprove' })).toBeInTheDocument();
  });

  it('shows an external citation unverified with its evidence control', async () => {
    vi.mocked(fetchReferences).mockResolvedValue([
      {
        id: 'ref-1',
        kind: 'external_citation',
        title: 'Archive',
        content: 'Bridge built 1889.',
        attribution: 'creator@example.com',
        sourceUrl: 'https://example.com/a',
        origin: 'external',
        verified: false,
        revision: 1,
        createdBy: 'creator@example.com',
        createdAt: 'now',
        updatedAt: 'now',
      },
    ]);
    vi.mocked(fetchStyleProfile).mockResolvedValue(null);

    render(
      <MemoryRouter>
        <ReferencesPanel bookId="book-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByText('ref.unverified')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ref.verify' })).toBeInTheDocument();
    expect(screen.getByText('https://example.com/a')).toBeInTheDocument();
  });

  it('gives the reference fields their own accessible names', async () => {
    vi.mocked(fetchReferences).mockResolvedValue([]);
    vi.mocked(fetchStyleProfile).mockResolvedValue(null);

    render(
      <MemoryRouter>
        <ReferencesPanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'ref.add' }));

    // The title, content and source-URL inputs must not all answer to the
    // generic "Kind"/"Evidence note" labels a screen reader would mis-announce.
    expect(await screen.findByLabelText('ref.titleLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('ref.contentLabel')).toBeInTheDocument();
  });

  it('saves the first style profile for a book that has none yet', async () => {
    const { saveStyleProfile } = await import('../../lib/api/creator');
    vi.mocked(fetchReferences).mockResolvedValue([]);
    vi.mocked(fetchStyleProfile).mockResolvedValue(null);
    vi.mocked(saveStyleProfile).mockResolvedValue({
      bookId: 'book-1',
      status: 'approved',
      approvedBy: 'creator@example.com',
      approvedAt: 'now',
      revision: 1,
    });

    render(
      <MemoryRouter>
        <ReferencesPanel bookId="book-1" />
      </MemoryRouter>,
    );

    const language = await screen.findByLabelText('ref.styleLanguage');
    fireEvent.change(language, { target: { value: 'English (British)' } });
    // The typed value must survive the controlled re-render, not just the DOM.
    expect(language).toHaveValue('English (British)');

    fireEvent.click(screen.getByRole('button', { name: 'ref.styleApprove' }));

    await waitFor(() => {
      expect(saveStyleProfile).toHaveBeenCalledWith(
        'book-1',
        expect.objectContaining({ language: 'English (British)', status: 'approved' }),
        'token',
      );
    });
  });
});
