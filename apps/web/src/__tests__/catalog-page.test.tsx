import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CatalogPage } from '../features/catalog/CatalogPage';

vi.mock('../lib/api', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        'catalog.title': 'Book Catalog',
        'catalog.subtitle': 'Browse our collection',
        'catalog.empty': 'No books available',
        'catalog.coverAlt': 'Cover of {title}',
        'catalog.search.placeholder': 'Search…',
        'catalog.filter.author': 'Author…',
        'catalog.filter.language': 'Language…',
        'catalog.pagination.info': 'Showing {from}–{to} of {total}',
      };
      let value = translations[key] ?? key;
      if (params) {
        for (const [name, v] of Object.entries(params)) {
          value = value.replace(`{${name}}`, String(v));
        }
      }
      return value;
    },
  }),
}));

import { apiRequest } from '../lib/api';
const mockApiRequest = vi.mocked(apiRequest);

function renderCatalogPage(initialEntry = '/catalog') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/catalog" element={<CatalogPage />} />
      </Routes>
    </MemoryRouter>,
  );
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
    const { container } = renderCatalogPage();

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
  });

  it('renders books after loading', async () => {
    mockApiRequest.mockResolvedValue({
      items: [
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
      ],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    renderCatalogPage();

    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
    });

    expect(screen.getByText('Author Name')).toBeInTheDocument();
    expect(screen.getByText('A test book description')).toBeInTheDocument();
  });

  it('shows error message on API failure', async () => {
    mockApiRequest.mockRejectedValue(new Error('Network error'));

    renderCatalogPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });

  it('shows empty state when no books', async () => {
    mockApiRequest.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    renderCatalogPage();

    await waitFor(() => {
      expect(screen.getByText('No books available')).toBeInTheDocument();
    });
  });

  it('passes q/author/language query params when present', async () => {
    mockApiRequest.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    renderCatalogPage('/catalog?q=orwell&author=Orwell&language=en');

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(expect.stringContaining('q=orwell'));
    });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- mock.calls[0] is unknown
    const call = mockApiRequest.mock.calls[0]?.[0] as string;
    expect(call).toContain('author=Orwell');
    expect(call).toContain('language=en');
    expect(call).toContain('limit=24');
  });

  it('renders book cover image when available', async () => {
    mockApiRequest.mockResolvedValue({
      items: [
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
      ],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    renderCatalogPage();

    await waitFor(() => {
      expect(screen.getByAltText('Cover of Book With Cover')).toBeInTheDocument();
    });
  });

  it('links to login page with book slug', async () => {
    mockApiRequest.mockResolvedValue({
      items: [
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
      ],
      total: 1,
      page: 1,
      pageSize: 24,
      hasMore: false,
    });

    renderCatalogPage();

    await waitFor(() => {
      const link = screen.getByText('My Book').closest('a');
      expect(link).toHaveAttribute('href', '/login?book=my-book');
    });
  });
});
