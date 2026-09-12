import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssistancePanel } from './AssistancePanel';
import { fetchAssistanceConsent, setAssistanceConsent } from '../../lib/api/creator';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: (selector: (s: { sessionToken: string }) => unknown) =>
    selector({ sessionToken: 'token' }),
}));

vi.mock('../../lib/api/creator', () => ({
  fetchAssistanceConsent: vi.fn(),
  setAssistanceConsent: vi.fn(),
}));

describe('AssistancePanel (Wave 4, synthetic fixtures for consent/UI paths)', () => {
  it('lists all four categories as unavailable while no engine is qualified', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    for (const key of ['asst.catSpelling', 'asst.catGrammar', 'asst.catStory', 'asst.catLogic']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
    // Every category reports the missing engine; none claims availability.
    await waitFor(() => {
      expect(screen.getAllByText('asst.engineMissing').length).toBeGreaterThanOrEqual(4);
    });
  });

  it('reports the missing engine when a check runs, never "no findings"', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'asst.runLabel' }));

    await waitFor(() => {
      expect(screen.getByText('asst.unavailable')).toBeInTheDocument();
    });
    // The dishonest outcome would read as a clean run.
    expect(screen.queryByText('asst.noFindings')).not.toBeInTheDocument();
  });

  it('shows cloud consent off by default and dispatch disabled as unqualified', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    const toggle = await screen.findByRole('checkbox');
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('asst.cloudConsentOff')).toBeInTheDocument();
    expect(screen.getByText('asst.cloudNotQualified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'asst.dispatch' })).not.toBeInTheDocument();
  });

  it('keeps dispatch disabled even after consent is granted', async () => {
    vi.mocked(fetchAssistanceConsent).mockResolvedValue({ allowed: false, cloudQualified: false });
    // The server still reports cloudQualified false; consent cannot imply it.
    vi.mocked(setAssistanceConsent).mockResolvedValue({ allowed: true, cloudQualified: false });

    render(
      <MemoryRouter>
        <AssistancePanel bookId="book-1" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('checkbox'));

    await waitFor(() => {
      expect(vi.mocked(setAssistanceConsent)).toHaveBeenCalledWith('book-1', true, 'token');
    });
    expect(await screen.findByRole('checkbox')).toBeChecked();
    expect(screen.getByText('asst.cloudNotQualified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'asst.dispatch' })).not.toBeInTheDocument();
  });
});
