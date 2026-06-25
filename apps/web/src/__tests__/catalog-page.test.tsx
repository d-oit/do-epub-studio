import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CatalogPage } from '../features/catalog/CatalogPage';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'catalog.title': 'Book Catalog',
        'catalog.subtitle': 'Browse our collection',
        'catalog.empty': 'No books available',
        'catalog.coverAlt': 'Cover of {title}',
      };
      return translations[key] ?? key;
    },
  }),
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

async function renderAndFlush(mock: () => Promise<unknown>) {
  mockApiRequest.mockImplementation(() => mock());
  await act(() => {
    render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );
    return Promise.resolve();
  });
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state initially', () => {
    mockApiRequest.mockReturnValue(new Promise(() => {}));
    const { container } = render(
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>,
    );

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders books after loading', async () => {
    await renderAndFlush(() =>
      Promise.resolve([
        {
          id: '1',
          slug: 'test-book',
          title: 'Test Book',
          authorName: 'Author Name',
          description: 'A test book description',
          language: 'en',
          coverImageUrl: 'https://example.com/cover.jpg',
          publishedAt: '2024-01-01',
        },
      ]),
    );

    expect(mockApiRequest).toHaveBeenCalledWith('/api/catalog');
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Author Name')).toBeInTheDocument();
    expect(screen.getByText('A test book description')).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    mockApiRequest.mockImplementation(() => Promise.reject(new Error('Network error')));
    act(() => {
      render(
        <MemoryRouter>
          <CatalogPage />
        </MemoryRouter>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
  });

  it('shows empty state when no books', async () => {
    await renderAndFlush(() => Promise.resolve([]));

    expect(screen.getByText('No books available')).toBeInTheDocument();
  });

  it('renders book cover image when available', async () => {
    await renderAndFlush(() =>
      Promise.resolve([
        {
          id: '1',
          slug: 'book-with-cover',
          title: 'Book With Cover',
          authorName: null,
          description: null,
          language: 'en',
          coverImageUrl: 'https://example.com/cover.jpg',
          publishedAt: null,
        },
      ]),
    );

    expect(screen.getByAltText('Cover of Book With Cover')).toBeInTheDocument();
  });

  it('links to login page with book slug', async () => {
    await renderAndFlush(() =>
      Promise.resolve([
        {
          id: '1',
          slug: 'my-book',
          title: 'My Book',
          authorName: null,
          description: null,
          language: 'en',
          coverImageUrl: null,
          publishedAt: null,
        },
      ]),
    );

    const link = screen.getByText('My Book').closest('a');
    expect(link).toHaveAttribute('href', '/login?book=my-book');
  });
});
