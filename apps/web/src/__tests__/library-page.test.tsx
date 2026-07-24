import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyLibraryPage } from '../features/library/MyLibraryPage';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../components/ui', () => ({
  AppLogo: () => <div data-testid="app-logo" />,
  ProgressBar: ({ label }: { label?: string }) => <div data-testid="progress-bar">{label}</div>,
}));

vi.mock('@do-epub-studio/ui', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('../config/app-identity', () => ({
  APP_NAME: 'Test App',
  APP_VERSION_LABEL: 'v0.0.1',
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

const mockBooks = [
  { id: '1', slug: 'book-1', title: 'In Progress Book', authorName: 'Author A', progressPercent: 45, progressUpdatedAt: '2026-07-20T00:00:00Z' },
  { id: '2', slug: 'book-2', title: 'Not Started Book', authorName: 'Author B', progressPercent: 0, progressUpdatedAt: null },
  { id: '3', slug: 'book-3', title: 'Completed Book', authorName: 'Author C', progressPercent: 100, progressUpdatedAt: '2026-07-15T00:00:00Z' },
];

function renderLibrary() {
  return render(
    <MemoryRouter>
      <MyLibraryPage />
    </MemoryRouter>,
  );
}

describe('MyLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    mockApiRequest.mockImplementation(() => new Promise(() => {}));
    renderLibrary();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message on fetch failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Failed to load'));
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load');
    });
  });

  it('shows empty state when no books', async () => {
    mockApiRequest.mockResolvedValue([]);
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText('library.empty')).toBeInTheDocument();
    });
  });

  it('renders books grouped by progress status', async () => {
    mockApiRequest.mockResolvedValue(mockBooks);
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText('library.inProgress')).toBeInTheDocument();
      expect(screen.getByText('library.notStarted')).toBeInTheDocument();
      expect(screen.getByText('library.completed')).toBeInTheDocument();
    });
  });

  it('renders book titles as links', async () => {
    mockApiRequest.mockResolvedValue(mockBooks);
    renderLibrary();
    await waitFor(() => {
      const link1 = screen.getByText('In Progress Book').closest('a');
      expect(link1).toHaveAttribute('href', '/read/book-1');
      const link2 = screen.getByText('Not Started Book').closest('a');
      expect(link2).toHaveAttribute('href', '/read/book-2');
      const link3 = screen.getByText('Completed Book').closest('a');
      expect(link3).toHaveAttribute('href', '/read/book-3');
    });
  });

  it('renders page title', async () => {
    mockApiRequest.mockResolvedValue([]);
    renderLibrary();
    await waitFor(() => {
      expect(screen.getByText('library.title')).toBeInTheDocument();
    });
  });
});
