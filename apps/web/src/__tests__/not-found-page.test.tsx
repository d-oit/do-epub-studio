import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotFoundPage } from '../features/errors/NotFoundPage';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'errors.notFound.title': 'Page Not Found',
        'errors.notFound.description': 'The page you are looking for does not exist.',
        'errors.notFound.backToHome': 'Back to Home',
      };
      return translations[key] ?? key;
    },
    locale: 'en',
    setLocale: vi.fn(),
  }),
}));

vi.mock('@do-epub-studio/ui', () => ({
  PageContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="page-container">
      {children}
    </div>
  ),
}));

describe('NotFoundPage', () => {
  function renderPage() {
    return render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>,
    );
  }

  it('renders 404 heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('404');
  });

  it('renders translated title', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Page Not Found');
  });

  it('renders translated description', () => {
    renderPage();
    expect(screen.getByText('The page you are looking for does not exist.')).toBeInTheDocument();
  });

  it('renders back to home link', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /Back to Home/i });
    expect(link).toHaveAttribute('href', '/');
  });

  it('has main content landmark', () => {
    renderPage();
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });

  it('has decorative SVGs with aria-hidden', () => {
    const { container } = renderPage();
    const hiddenSvgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(hiddenSvgs.length).toBeGreaterThan(0);
  });

  it('wraps in PageContainer', () => {
    renderPage();
    expect(screen.getByTestId('page-container')).toBeInTheDocument();
  });
});
