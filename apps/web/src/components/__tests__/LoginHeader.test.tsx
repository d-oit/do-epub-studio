import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginHeader } from '../LoginHeader';

vi.mock('../LocaleSwitcher', () => ({
  LocaleSwitcher: () => <select data-testid="mock-locale-switcher" aria-label="Select language" />,
}));

vi.mock('../ThemeToggle', () => ({
  ThemeToggle: () => <button data-testid="mock-theme-toggle" aria-label="Toggle theme">Theme</button>,
}));

describe('LoginHeader', () => {
  it('renders theme toggle and locale switcher inside a dedicated header container', () => {
    render(<LoginHeader />);

    const header = screen.getByTestId('login-header');
    expect(header).toBeInTheDocument();
    expect(header.tagName.toLowerCase()).toBe('header');

    expect(screen.getByTestId('mock-theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('mock-locale-switcher')).toBeInTheDocument();
  });

  it('applies flex layout and custom class names', () => {
    render(<LoginHeader className="custom-test-class" />);

    const header = screen.getByTestId('login-header');
    expect(header).toHaveClass('custom-test-class');
    expect(header).toHaveClass('w-full');
    expect(header).toHaveClass('flex');
  });
});
