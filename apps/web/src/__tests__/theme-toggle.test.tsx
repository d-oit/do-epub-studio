import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../components/ThemeToggle';
import { usePreferencesStore } from '../stores/preferences';

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'theme.toggle.light': 'Switch to light mode',
        'theme.toggle.dark': 'Switch to dark mode',
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('../components/ui', () => ({
  IconButton: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreferencesStore.setState({
      reader: {
        theme: 'system',
        fontFamily: 'serif',
        fontSize: 'medium',
        lineHeight: 2,
        pageWidth: 'normal',
        direction: 'default',
        writingMode: 'horizontal-tb',
        fixedLayoutZoom: 1.0,
        fixedLayoutSpread: 'auto',
      },
    });
  });

  it('renders dark mode button when theme is light', () => {
    usePreferencesStore.getState().setTheme('light');
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to dark mode')).toBeInTheDocument();
  });

  it('renders light mode button when theme is dark', () => {
    usePreferencesStore.getState().setTheme('dark');
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to light mode')).toBeInTheDocument();
  });

  it('toggles theme on click', () => {
    usePreferencesStore.getState().setTheme('light');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to dark mode'));
    expect(usePreferencesStore.getState().reader.theme).toBe('dark');
  });

  it('toggles from dark to light', () => {
    usePreferencesStore.getState().setTheme('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to light mode'));
    expect(usePreferencesStore.getState().reader.theme).toBe('light');
  });

  it('handles system theme', () => {
    usePreferencesStore.getState().setTheme('system');
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
