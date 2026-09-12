import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  updateReference: vi.fn(),
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
});
