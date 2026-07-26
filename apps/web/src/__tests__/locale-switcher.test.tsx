import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleSwitcher } from '../components/LocaleSwitcher';

const mockSetLocale = vi.fn();

vi.mock('../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'a11y.select_locale': 'Select locale',
      };
      return translations[key] ?? key;
    },
    locale: 'en',
    setLocale: mockSetLocale,
  }),
}));

vi.mock('../i18n', () => ({
  availableLocales: () => [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
  ],
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a select element with accessible label', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('combobox', { name: 'Select locale' })).toBeInTheDocument();
  });

  it('renders all available locale options', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();
  });

  it('sets the current locale as the selected value', () => {
    render(<LocaleSwitcher />);
    expect(screen.getByRole('combobox')).toHaveValue('en');
  });

  it('calls setLocale when a different locale is selected', () => {
    render(<LocaleSwitcher />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'de' } });
    expect(mockSetLocale).toHaveBeenCalledWith('de');
  });

  it('calls setLocale with correct value for French', () => {
    render(<LocaleSwitcher />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'fr' } });
    expect(mockSetLocale).toHaveBeenCalledWith('fr');
  });

  it('renders the correct number of options', () => {
    render(<LocaleSwitcher />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3);
  });

  it('has the select styling classes', () => {
    render(<LocaleSwitcher />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveClass('rounded-lg', 'text-sm');
  });
});
