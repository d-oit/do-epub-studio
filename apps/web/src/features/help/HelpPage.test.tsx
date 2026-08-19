import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelpPage } from './HelpPage';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));
vi.mock('../../components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));
vi.mock('../../components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock('../../components/ui', () => ({
  AppLogo: () => <div data-testid="app-logo" />,
  Button: ({ children, className }: { children?: React.ReactNode; variant?: string; className?: string }) => (
    <button type="button" className={className}>{children}</button>
  ),
}));

describe('HelpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders app intro', () => {
    render(<MemoryRouter><HelpPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /help.title/ })).toBeInTheDocument();
    expect(screen.getByText(/help.intro/)).toBeInTheDocument();
  });

  it('shows demo accounts on the info page regardless of demo flag', () => {
    render(<MemoryRouter><HelpPage /></MemoryRouter>);
    expect(screen.getByText(/help.demoTitle/)).toBeInTheDocument();
    expect(screen.getByText(/help.demoReader/)).toBeInTheDocument();
    expect(screen.getByText(/help.demoAdmin/)).toBeInTheDocument();
  });

  it('links back to login', () => {
    render(<MemoryRouter><HelpPage /></MemoryRouter>);
    const link = screen.getByText('help.backToLogin').closest('a');
    expect(link).toHaveAttribute('href', '/login');
  });

  it('renders theme toggle and locale switcher', () => {
    render(<MemoryRouter><HelpPage /></MemoryRouter>);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });
});
